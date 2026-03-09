package com.amdaani.app.posprinter

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.OutputStream
import java.util.*
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

@ReactModule(name = PrinterModule.NAME)
class PrinterModule(private val reactCtx: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactCtx) {

    companion object {
        const val NAME = "PrinterModule"
        private val SPP_UUID: UUID =
            UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    }

    private val adapter: BluetoothAdapter? get() = BluetoothAdapter.getDefaultAdapter()
    private var socket: BluetoothSocket? = null
    private var out: OutputStream? = null
    private val writeQueue = ArrayBlockingQueue<ByteArray>(256)
    private val writerRunning = AtomicBoolean(false)

    override fun getName() = NAME

    // -------------------- Bluetooth --------------------

    @ReactMethod
    fun isBluetoothAvailable(promise: Promise) {
        promise.resolve(adapter != null && adapter!!.isEnabled)
    }

    @ReactMethod
    fun getPairedDevices(promise: Promise) {
        try {
            val arr = Arguments.createArray()
            adapter?.bondedDevices?.forEach { d ->
                val m = Arguments.createMap()
                m.putString("name", d.name ?: "Unknown")
                m.putString("address", d.address)
                arr.pushMap(m)
            }
            promise.resolve(arr)
        } catch (e: Exception) {
            promise.reject("PAIRED_ERROR", e)
        }
    }

    // discovery with events
    @SuppressLint("MissingPermission")
    @ReactMethod
    fun scan(promise: Promise) {
        try {
            val adapter = adapter ?: throw Exception("No BT adapter")
            if (adapter.isDiscovering) adapter.cancelDiscovery()

            val filter = IntentFilter()
            filter.addAction(BluetoothDevice.ACTION_FOUND)
            filter.addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED)

            val receiver = object : BroadcastReceiver() {
                override fun onReceive(ctx: Context?, intent: Intent?) {
                    when (intent?.action) {
                        BluetoothDevice.ACTION_FOUND -> {
                            val device: BluetoothDevice? =
                                intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
                            if (device != null) {
                                val map = Arguments.createMap()
                                map.putString("name", device.name ?: "Unknown")
                                map.putString("address", device.address)
                                reactApplicationContext
                                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                                    .emit("PrinterFound", map)
                                Log.d(
                                    "PrinterModule",
                                    "Found device: ${device.name} - ${device.address}"
                                )
                            }
                        }

                        BluetoothAdapter.ACTION_DISCOVERY_FINISHED -> {
                            reactApplicationContext
                                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                                .emit("ScanFinished", null)
                            Log.d("PrinterModule", "Discovery finished")
                            try {
                                ctx?.unregisterReceiver(this)
                            } catch (_: Exception) {
                            }
                        }
                    }
                }
            }

            reactApplicationContext.registerReceiver(receiver, filter)
            val ok = adapter.startDiscovery()
            Log.d("PrinterModule", "Starting discovery = $ok")

            // return immediately, devices will be emitted
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("PrinterModule", "Scan error", e)
            promise.reject("SCAN_ERROR", e)
        }
    }

   @SuppressLint("MissingPermission")
@ReactMethod
fun connect(address: String, promise: Promise) {
    thread {
        try {
            val device = adapter?.getRemoteDevice(address)
                ?: throw Exception("Device not found: $address")

            // close previous
            closeSocket()

            adapter?.cancelDiscovery()

            var sock: BluetoothSocket? = null
            try {
                sock = device.createRfcommSocketToServiceRecord(SPP_UUID)
                sock.connect()
            } catch (e1: Exception) {
                try {
                    // insecure socket
                    sock?.close()
                    sock = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID)
                    sock.connect()
                } catch (e2: Exception) {
                    try {
                        sock?.close()
                        val m = device.javaClass.getMethod("createRfcommSocket", Int::class.java)
                        sock = m.invoke(device, 1) as BluetoothSocket
                        sock.connect()
                    } catch (e3: Exception) {
                        throw e3
                    }
                }
            }

            socket = sock
            out = sock?.outputStream
            lastConnectedAddress = address 
            startWriterIfNeeded()
            Log.d("PrinterModule", "Connected to $address")
            reactApplicationContext.runOnUiQueueThread { promise.resolve(true) }
        } catch (e: Exception) {
            Log.e("PrinterModule", "Connect error", e)
            closeSocket()
            reactApplicationContext.runOnUiQueueThread { promise.reject("CONNECT_ERROR", e) }
        }
    }
}


  @ReactMethod
fun isConnected(promise: Promise) {
    thread {
        try {
            val s = socket
            if (s == null || !s.isConnected) {
                reactApplicationContext.runOnUiQueueThread {
                    promise.resolve(false)
                }
                return@thread
            }

            // ✅ Perform a small write test to confirm real connection
            try {
                val outStream = out
                outStream?.write(0x1B) // send ESC command (harmless)
                outStream?.flush()
                reactApplicationContext.runOnUiQueueThread {
                    promise.resolve(true)
                }
            } catch (e: Exception) {
                Log.w("PrinterModule", "Connection test failed: ${e.message}")
                closeSocket()
                reactApplicationContext.runOnUiQueueThread {
                    promise.resolve(false)
                }
            }
        } catch (e: Exception) {
            Log.e("PrinterModule", "isConnected check failed", e)
            reactApplicationContext.runOnUiQueueThread {
                promise.resolve(false)
            }
        }
    }
}


    private var lastConnectedAddress: String? = null

@ReactMethod
fun connectLastDevice(promise: Promise) {
    thread {
        try {
            val addr = lastConnectedAddress
            if (addr.isNullOrBlank()) {
                reactApplicationContext.runOnUiQueueThread {
                    promise.reject("NO_LAST_DEVICE", "No previously connected device")
                }
                return@thread
            }
            connect(addr, promise)  // reuse existing connect()
        } catch (e: Exception) {
            reactApplicationContext.runOnUiQueueThread {
                promise.reject("CONNECT_LAST_ERROR", e)
            }
        }
    }
}

@ReactMethod
fun connectPairedPrinter(promise: Promise) {
    thread {
        try {
            val paired = adapter?.bondedDevices?.firstOrNull()
            if (paired == null) {
                reactApplicationContext.runOnUiQueueThread {
                    promise.reject("NO_PAIRED_DEVICE", "No paired printers found")
                }
                return@thread
            }
            connect(paired.address, promise)
        } catch (e: Exception) {
            reactApplicationContext.runOnUiQueueThread {
                promise.reject("CONNECT_PAIRED_ERROR", e)
            }
        }
    }
}

    @ReactMethod
    fun disconnect(promise: Promise) {
        closeSocket()
        promise.resolve(true)
    }
// inside PrinterModule class (near other @ReactMethod functions)

private var btStateReceiverRegistered = false
private val btStateReceiver = object: BroadcastReceiver() {
    override fun onReceive(ctx: Context?, intent: Intent?) {
        if (intent == null) return
        val action = intent.action
        if (action == BluetoothAdapter.ACTION_STATE_CHANGED) {
            val state = intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, -1)
            val stateStr = when (state) {
                BluetoothAdapter.STATE_OFF -> "OFF"
                BluetoothAdapter.STATE_TURNING_OFF -> "TURNING_OFF"
                BluetoothAdapter.STATE_ON -> "ON"
                BluetoothAdapter.STATE_TURNING_ON -> "TURNING_ON"
                else -> "UNKNOWN"
            }
            val map = Arguments.createMap()
            map.putString("state", stateStr)
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("BluetoothStateChanged", map)
        }
    }
}

private fun ensureBtStateReceiver() {
    if (btStateReceiverRegistered) return
    try {
        val f = IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED)
        reactApplicationContext.registerReceiver(btStateReceiver, f)
        btStateReceiverRegistered = true
    } catch (_: Exception) {}
}

@ReactMethod
fun getBluetoothState(promise: Promise) {
    try {
        val a = adapter
        val s = when {
            a == null -> "NO_ADAPTER"
            a.isEnabled -> "ON"
            else -> "OFF"
        }
        promise.resolve(s)
    } catch (e: Exception) {
        promise.reject("BT_STATE_ERROR", e)
    } finally {
        ensureBtStateReceiver()
    }
}

@ReactMethod
fun requestEnable(promise: Promise) {
    try {
        val act = currentActivity
        if (act == null) {
            promise.reject("NO_ACTIVITY", "No current activity")
            return
        }
        val intent = Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        act.startActivity(intent)
        promise.resolve(true)
    } catch (e: Exception) {
        promise.reject("REQUEST_ENABLE_ERROR", e)
    } finally {
        ensureBtStateReceiver()
    }
}

    // -------------------- Printing --------------------

 @ReactMethod
fun printText(text: String, options: ReadableMap?, promise: Promise) {
    try {
        val align = options?.getString("align") ?: "left"
        val bold = if (options != null && options.hasKey("bold")) options.getBoolean("bold") else false
        val sizeW = if (options != null && options.hasKey("sizeW")) options.getInt("sizeW") else 1
        val sizeH = if (options != null && options.hasKey("sizeH")) options.getInt("sizeH") else 1
        val font = if (options != null && options.hasKey("font")) options.getString("font") else "a"

        val cmds = ArrayList<ByteArray>()
        cmds += ESCPos.init()
        cmds += ESCPos.align(
            when (align) {
                "center" -> 1
                "right" -> 2
                else -> 0
            }
        )
        cmds += ESCPos.bold(bold)
        cmds += ESCPos.font(font ?: "a")   // ✅ apply font A or B
        cmds += ESCPos.size(sizeW, sizeH)
        cmds += ESCPos.text(text)
        enqueue(cmds.reduce { acc, bytes -> acc + bytes })
        promise.resolve(true)
    } catch (e: Exception) {
        promise.reject("PRINT_TEXT_ERROR", e)
    }
}


   @ReactMethod
fun printColumns(
    widths: ReadableArray,
    aligns: ReadableArray,
    texts: ReadableArray,
    options: ReadableMap?,   // ✅ optional settings
    promise: Promise
) {
    try {
        val bold = if (options != null && options.hasKey("bold")) options.getBoolean("bold") else false
        val sizeW = if (options != null && options.hasKey("sizeW")) options.getInt("sizeW") else 1
        val sizeH = if (options != null && options.hasKey("sizeH")) options.getInt("sizeH") else 1
        val font = if (options != null && options.hasKey("font")) options.getString("font") else "a"

        val line = buildString {
            for (i in 0 until texts.size()) {
                val w = widths.getInt(i)
                val a = aligns.getString(i) ?: "left"
                val t = texts.getString(i) ?: ""
                append(pad(t, w, a))
            }
        }

        val cmds = ArrayList<ByteArray>()
        cmds += ESCPos.init()
        cmds += ESCPos.bold(bold)
        cmds += ESCPos.font(font ?: "a")
        cmds += ESCPos.size(sizeW, sizeH)
        cmds += ESCPos.text(line)

        enqueue(cmds.reduce { acc, bytes -> acc + bytes })
        promise.resolve(true)
    } catch (e: Exception) {
        promise.reject("PRINT_COL_ERROR", e)
    }
}


    @ReactMethod
    fun printQRCode(data: String, size: Int, promise: Promise) {
        try {
            enqueue(ESCPos.qr(data, size))
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("PRINT_QR_ERROR", e)
        }
    }

 @ReactMethod
fun printImageBase64(base64: String, targetWidthPx: Int, mode: String, align: String?, promise: Promise) {
    try {
        Log.d("PrinterModule", "printImageBase64: inputLen=${base64.length}, targetWidth=$targetWidthPx")
        val r = BitmapTools.base64ToRaster(base64, targetWidthPx, mode)
        Log.d("PrinterModule", "Raster ready: widthBytes=${r.widthBytes}, height=${r.height}, dataSize=${r.data.size}")
        val sample = r.data.take(8).joinToString(",") { (it.toInt() and 0xFF).toString(16) }
        Log.d("PrinterModule", "Raster sample[0..7]=[$sample]")

        val cmds = ArrayList<ByteArray>()
        cmds += ESCPos.init()

        // ✅ Apply alignment from JS (default center)
        cmds += ESCPos.align(
            when (align) {
                "left" -> 0
                "right" -> 2
                else -> 1
            }
        )

        cmds += ESCPos.raster(r.widthBytes, r.height, r.data)
        cmds += ESCPos.feed(1)

        enqueue(cmds.reduce { acc, bytes -> acc + bytes })
        promise.resolve(true)
    } catch (e: Exception) {
        Log.e("PrinterModule", "PRINT_IMG_ERROR", e)
        promise.reject("PRINT_IMG_ERROR", e)
    }
}



    @ReactMethod
    fun feed(lines: Int, promise: Promise) {
        enqueue(ESCPos.feed(lines))
        promise.resolve(true)
    }

    @ReactMethod
    fun cut(promise: Promise) {
        enqueue(ESCPos.cut())
        promise.resolve(true)
    }

    @ReactMethod
    fun openCashDrawer(promise: Promise) {
        enqueue(ESCPos.openCashDrawer())
        promise.resolve(true)
    }

    // -------------------- Helpers --------------------

    private fun startWriterIfNeeded() {
        if (writerRunning.getAndSet(true)) return
        thread(name = "PrinterWriter") {
            try {
                while (writerRunning.get()) {
                    val data = writeQueue.take()
                    out?.write(data)
                    out?.flush()
                }
            } catch (_: InterruptedException) {
            } catch (e: Exception) {
                Log.e("PrinterModule", "Writer error", e)
            } finally {
                writerRunning.set(false)
            }
        }
    }

    private fun enqueue(bytes: ByteArray) {
        if (socket?.isConnected != true) throw IllegalStateException("Printer not connected")
        writeQueue.offer(bytes)
        startWriterIfNeeded()
    }

    private fun closeSocket() {
        try {
            out?.close()
        } catch (_: Exception) {
        }
        try {
            socket?.close()
        } catch (_: Exception) {
        }
        out = null
        socket = null
        writerRunning.set(false)
        writeQueue.clear()
    }

    private fun pad(text: String, width: Int, align: String): String {
        val t = if (text.length > width) text.substring(0, width) else text
        val spaces = " ".repeat((width - t.length).coerceAtLeast(0))
        return when (align) {
            "right" -> spaces + t
            "center" -> {
                val l = spaces.length / 2
                " ".repeat(l) + t + " ".repeat(spaces.length - l)
            }
            else -> t + spaces
        }
    }
}
