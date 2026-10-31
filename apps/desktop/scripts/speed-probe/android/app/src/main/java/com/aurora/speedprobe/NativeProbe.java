package com.aurora.speedprobe;
public class NativeProbe {
    static { System.loadLibrary("aurora_speed_probe"); }
    public static native String legacy();
    public static native String fixed();
}
