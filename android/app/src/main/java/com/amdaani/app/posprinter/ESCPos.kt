package com.amdaani.app.posprinter

import java.nio.charset.Charset

object ESCPos {
    val ESC = 0x1B.toByte()
    val FS  = 0x1C.toByte()
    val GS  = 0x1D.toByte()
    val NL  = 0x0A.toByte()

    fun init(): ByteArray = byteArrayOf(ESC, '@'.code.toByte())

    fun align(center: Int): ByteArray {
        // 0=left,1=center,2=right
        return byteArrayOf(ESC, 'a'.code.toByte(), center.toByte())
    }

    fun bold(on: Boolean): ByteArray = byteArrayOf(ESC, 'E'.code.toByte(), if (on) 1 else 0)

    fun size(w: Int, h: Int): ByteArray {
        val v = (w - 1) * 16 + (h - 1)
        return byteArrayOf(GS, '!'.code.toByte(), v.toByte())
    }

    fun underline(on: Boolean): ByteArray = byteArrayOf(ESC, '-'.code.toByte(), if (on) 1 else 0)

    fun feed(lines: Int): ByteArray = ByteArray(lines) { NL }

    fun cut(full: Boolean = true): ByteArray =
        byteArrayOf(GS, 'V'.code.toByte(), if (full) 0x00 else 0x01)

    fun openCashDrawer(): ByteArray =
        byteArrayOf(ESC, 'p'.code.toByte(), 0x00, 0x3C, 0xFF.toByte())

    fun text(s: String, charset: String = "GBK"): ByteArray =
        s.toByteArray(Charset.forName(charset)) + byteArrayOf(NL)

    // ✅ Font selection (A = normal, B = small)
    fun font(type: String): ByteArray {
        val fontByte = when (type.lowercase()) {
            "b" -> 1.toByte() // Font B (small)
            else -> 0.toByte() // Font A (default)
        }
        return byteArrayOf(ESC, 'M'.code.toByte(), fontByte)
    }

    // QR: GS ( k pL pH cn fn n [data]
    fun qr(data: String, size: Int = 6): ByteArray {
        val store = qrStore(data)
        val setSize = byteArrayOf(GS, '('.code.toByte(), 'k'.code.toByte(), 3, 0, 49, 67, size.toByte())
        val model = byteArrayOf(GS, '('.code.toByte(), 'k'.code.toByte(), 3, 0, 49, 65, 0x33)
        val print = byteArrayOf(GS, '('.code.toByte(), 'k'.code.toByte(), 3, 0, 49, 81, 48)
        return model + setSize + store + print + byteArrayOf(NL)
    }

    private fun qrStore(data: String): ByteArray {
        val bytes = data.toByteArray(Charsets.UTF_8)
        val pL = ((bytes.size + 3) and 0xFF).toByte()
        val pH = (((bytes.size + 3) shr 8) and 0xFF).toByte()
        return byteArrayOf(GS, '('.code.toByte(), 'k'.code.toByte(), pL, pH, 49, 80, 48) + bytes
    }

    // Raster bit image (GS v 0): pass raw 8px-per-bit rows (already dithered)
    fun raster(widthBytes: Int, height: Int, data: ByteArray): ByteArray {
        val xL = (widthBytes and 0xFF).toByte()
        val xH = ((widthBytes shr 8) and 0xFF).toByte()
        val yL = (height and 0xFF).toByte()
        val yH = ((height shr 8) and 0xFF).toByte()
        return byteArrayOf(GS, 'v'.code.toByte(), '0'.code.toByte(), 0x00, xL, xH, yL, yH) + data
    }
}
