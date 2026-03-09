// BitmapTools.kt
package com.amdaani.app.posprinter

import android.graphics.*
import android.util.Base64
import android.util.Log
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileOutputStream
import java.lang.Exception

object BitmapTools {
    private const val TAG = "BitmapTools"
    private const val SAVE_DEBUG = false // set true while debugging on device

    data class Raster(val widthBytes: Int, val height: Int, val data: ByteArray)

    /**
     * Convert a dataURL or bare base64 to ESC/POS raster.
     * @param b64 the full data URL like "data:image/png;base64,AAA..." or raw base64
     * @param targetWidthPx width in pixels to scale image to (typical 384 for 58mm head)
     * @param method "floyd" | "bayer" | "threshold" (uses Otsu for threshold)
     */
    fun base64ToRaster(b64: String, targetWidthPx: Int = 384, method: String = "floyd"): Raster {
        try {
            Log.d(TAG, "base64ToRaster: method=$method inputLen=${b64.length}, targetWidth=$targetWidthPx")

            val pure = b64.substringAfter("base64,", b64)
            val bytes = Base64.decode(pure, Base64.DEFAULT)
            Log.d(TAG, "Decoded bytes=${bytes.size}")

            val bmp = BitmapFactory.decodeStream(ByteArrayInputStream(bytes))
            requireNotNull(bmp) { "Bitmap decode failed" }
            Log.d(TAG, "Decoded bitmap: ${bmp.width}x${bmp.height} config=${bmp.config}")

            val scaled = scaleToWidth(bmp, targetWidthPx)
            Log.d(TAG, "Scaled bitmap: ${scaled.width}x${scaled.height}")

            val mono = when (method.lowercase()) {
                "bayer" -> bayerDither(scaled)
                "threshold" -> thresholdBW(scaled)
                else -> floydSteinbergDither(scaled)
            }

            Log.d(TAG, "Monochrome bitmap: ${mono.width}x${mono.height} conf=${mono.config}")

            if (SAVE_DEBUG) {
                saveBitmapDebug(scaled, "scaled_preview")
                saveBitmapDebug(mono, "mono_preview_${method}")
            }

            val raster = toEscPosRaster(mono)
            Log.d(TAG, "Raster: widthBytes=${raster.widthBytes}, height=${raster.height}, dataSize=${raster.data.size}")
            return raster
        } catch (ex: Exception) {
            Log.e(TAG, "base64ToRaster error", ex)
            throw ex
        }
    }

    // ---------------- Scaling ----------------
    private fun scaleToWidth(src: Bitmap, width: Int): Bitmap {
        if (src.width == width) return src.copy(Bitmap.Config.ARGB_8888, true)

        val ratio = width.toFloat() / src.width
        val height = (src.height * ratio).toInt().coerceAtLeast(1)

        val out = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(out)
        val paint = Paint(Paint.FILTER_BITMAP_FLAG).apply {
            isAntiAlias = true
            isDither = true
        }
        val srcRect = Rect(0, 0, src.width, src.height)
        val dstRect = Rect(0, 0, width, height)
        canvas.drawBitmap(src, srcRect, dstRect, paint)
        return out
    }

    // ---------------- Dithering Algorithms ----------------

    // 1) Floyd–Steinberg error-diffusion (good for photos)
    private fun floydSteinbergDither(src: Bitmap): Bitmap {
        val w = src.width
        val h = src.height
        val pixels = IntArray(w * h)
        src.getPixels(pixels, 0, w, 0, 0, w, h)

        val gray = IntArray(w * h)
        for (i in pixels.indices) {
            val c = pixels[i]
            gray[i] = ((0.299 * Color.red(c) + 0.587 * Color.green(c) + 0.114 * Color.blue(c))).toInt()
        }

        // compute adaptive threshold via Otsu
        val threshold = computeOtsuThreshold(gray)
        Log.d(TAG, "floydSteinbergDither: Otsu threshold=$threshold")

        val err = DoubleArray(w * h)
        for (y in 0 until h) {
            for (x in 0 until w) {
                val i = y * w + x
                val old = gray[i] + err[i]
                val newPix = if (old < threshold) 0 else 255
                val e = old - newPix
                gray[i] = newPix
                if (x + 1 < w) err[i + 1] += e * 7 / 16.0
                if (y + 1 < h) {
                    if (x > 0) err[i + w - 1] += e * 3 / 16.0
                    err[i + w] += e * 5 / 16.0
                    if (x + 1 < w) err[i + w + 1] += e * 1 / 16.0
                }
            }
        }

        val out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val outPixels = IntArray(w * h)
        for (i in outPixels.indices) {
            outPixels[i] = if (gray[i] < threshold) Color.BLACK else Color.WHITE
        }
        out.setPixels(outPixels, 0, w, 0, 0, w, h)
        return out
    }

    // 2) Ordered (Bayer) dithering - good for logos and text (cleaner for vector-ish images)
    private fun bayerDither(src: Bitmap): Bitmap {
        val w = src.width
        val h = src.height
        val pixels = IntArray(w * h)
        src.getPixels(pixels, 0, w, 0, 0, w, h)

        val bayer4 = arrayOf(
            intArrayOf(0, 8, 2, 10),
            intArrayOf(12, 4, 14, 6),
            intArrayOf(3, 11, 1, 9),
            intArrayOf(15, 7, 13, 5)
        ) // normalized 0-15

        val out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val outPixels = IntArray(w * h)

        for (y in 0 until h) {
            for (x in 0 until w) {
                val i = y * w + x
                val c = pixels[i]
                val gray = ((0.299 * Color.red(c) + 0.587 * Color.green(c) + 0.114 * Color.blue(c))).toInt()
                val threshold = ((bayer4[y % 4][x % 4] + 0.5) * (255.0 / 16.0)).toInt()
                outPixels[i] = if (gray < threshold) Color.BLACK else Color.WHITE
            }
        }
        out.setPixels(outPixels, 0, w, 0, 0, w, h)
        return out
    }

    // 3) Simple threshold using Otsu (clean for logos)
    private fun thresholdBW(src: Bitmap): Bitmap {
        val w = src.width
        val h = src.height
        val pixels = IntArray(w * h)
        src.getPixels(pixels, 0, w, 0, 0, w, h)

        val gray = IntArray(w * h)
        for (i in pixels.indices) {
            val c = pixels[i]
            gray[i] = ((0.299 * Color.red(c) + 0.587 * Color.green(c) + 0.114 * Color.blue(c))).toInt()
        }

        val threshold = computeOtsuThreshold(gray)
        Log.d(TAG, "thresholdBW: Otsu threshold=$threshold")

        val out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val outPixels = IntArray(w * h)
        for (i in outPixels.indices) {
            outPixels[i] = if (gray[i] < threshold) Color.BLACK else Color.WHITE
        }
        out.setPixels(outPixels, 0, w, 0, 0, w, h)
        return out
    }

    // ---------------- Otsu threshold ----------------
    private fun computeOtsuThreshold(gray: IntArray): Int {
        // histogram 0..255
        val hist = IntArray(256)
        for (g in gray) {
            val v = g.coerceIn(0, 255)
            hist[v]++
        }
        val total = gray.size
        var sum = 0L
        for (t in 0..255) sum += t * hist[t]

        var sumB = 0L
        var wB = 0
        var maxVar = -1.0
        var threshold = 128

        for (t in 0..255) {
            wB += hist[t]
            if (wB == 0) continue
            val wF = total - wB
            if (wF == 0) break
            sumB += t * hist[t]
            val mB = sumB.toDouble() / wB
            val mF = (sum - sumB).toDouble() / wF
            val varBetween = wB.toDouble() * wF.toDouble() * (mB - mF) * (mB - mF)
            if (varBetween > maxVar) {
                maxVar = varBetween
                threshold = t
            }
        }
        return threshold
    }

    // ---------------- ESC/POS raster packing ----------------
    private fun toEscPosRaster(bmp: Bitmap): Raster {
        val w = bmp.width
        val h = bmp.height
        val widthBytes = (w + 7) / 8
        val data = ByteArray(widthBytes * h)
        val line = IntArray(w)
        for (y in 0 until h) {
            bmp.getPixels(line, 0, w, 0, y, w, 1)
            for (x in 0 until w) {
                val c = line[x]
                val lum = (0.299 * Color.red(c) + 0.587 * Color.green(c) + 0.114 * Color.blue(c))
                val bit = if (lum < 128) 1 else 0 // 1 = black dot
                if (bit == 1) {
                    val index = y * widthBytes + (x / 8)
                    // set bit (MSB-first)
                    data[index] = (data[index].toInt() or (0x80 ushr (x % 8))).toByte()
                }
            }
        }
        return Raster(widthBytes, h, data)
    }

    // ---------------- Debug: save PNG (optional) ----------------
    private fun saveBitmapDebug(bmp: Bitmap, name: String) {
        try {
            val path = File("/sdcard/Download")
            if (!path.exists()) path.mkdirs()
            val f = File(path, "$name.png")
            FileOutputStream(f).use { out ->
                bmp.compress(Bitmap.CompressFormat.PNG, 100, out)
                out.flush()
            }
            Log.d(TAG, "Saved preview: ${f.absolutePath}")
        } catch (e: Exception) {
            Log.e(TAG, "saveBitmapDebug failed", e)
        }
    }
}
