package com.aurora.speedprobe;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class TlsRegressionTest {
    @Test(timeout=25000) public void oldImplicitLocateReproducesUninitializedVerifierPanic() {
        String result = NativeProbe.legacy();
        android.util.Log.i("AuroraSpeedProof", "Legacy: " + result);
        assertTrue(result, result.startsWith("PANIC:"));
        assertTrue(result, result.contains("Expect rustls-platform-verifier to be initialized"));
    }
    @Test(timeout=20000) public void fixedDiscoveryUsesValidHttpsWithoutAndroidVerifierSetup() {
        String result = NativeProbe.fixed();
        android.util.Log.i("AuroraSpeedProof", "Fixed: " + result);
        assertTrue(result, result.startsWith("OK: "));
    }
}
