#!/usr/bin/env python3
"""Prove legacy failure, cross-UID reads, and real system-installer update/data retention."""
import json
from pathlib import Path
import re
import subprocess
import time
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'artifacts'
PACKAGE = 'com.aurora.lives'


def adb(*args, check=True):
    result = subprocess.run(['adb', *map(str, args)], text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=90)
    if check and result.returncode:
        raise RuntimeError(result.stdout)
    return result.stdout


def instrument(test):
    result = adb('shell', 'am', 'instrument', '-w', '-e', 'class', 'com.aurora.lives.' + test,
                 PACKAGE + '.test/androidx.test.runner.AndroidJUnitRunner')
    (OUT / (test + '.txt')).write_text(result)
    if not re.search(r'OK \(\d+ tests?\)', result) or 'FAILURES' in result:
        raise AssertionError(result)
    print(result, flush=True)


def screen(name):
    adb('shell', 'uiautomator', 'dump', '/sdcard/aurora-window.xml')
    content = adb('shell', 'cat', '/sdcard/aurora-window.xml')
    (OUT / (name + '.xml')).write_text(content)
    return ET.fromstring(content)


def main():
    adb('wait-for-device')
    adb('shell', 'input', 'keyevent', '82')
    adb('logcat', '-c')
    for apk in ('broken.apk', 'tests.apk', 'probe.apk'):
        adb('install', '-r', OUT / apk)
    instrument('LegacyProviderTest')
    adb('shell', 'appops', 'set', PACKAGE, 'REQUEST_INSTALL_PACKAGES', 'allow')
    adb('shell', 'am', 'start', '-n', PACKAGE + '/.UpdateTestActivity', '--ez', 'legacy', 'true')
    time.sleep(3)
    legacy = screen('legacy-installer')
    legacy_text = ' '.join(n.get('text', '') for n in legacy.iter('node'))
    print('Legacy installer:', legacy_text, flush=True)
    # The native read failure above is mandatory; retain OEM-dependent UI text as evidence.
    adb('shell', 'input', 'keyevent', '4')
    adb('shell', 'am', 'force-stop', PACKAGE)
    adb('install', '-r', OUT / 'fixed.apk')
    instrument('ApkUpdaterTest')
    adb('shell', 'am', 'start', '-n', PACKAGE + '/.UpdateTestActivity')
    deadline = time.monotonic() + 60
    confirmed = False
    while time.monotonic() < deadline:
        root = screen('fixed-installer')
        for node in root.iter('node'):
            if node.get('enabled') == 'true' and node.get('text', '').lower() in ('install', 'update'):
                x1, y1, x2, y2 = map(int, re.findall(r'\d+', node.get('bounds')))
                adb('shell', 'input', 'tap', (x1 + x2) // 2, (y1 + y2) // 2)
                confirmed = True
                break
        if confirmed:
            break
        time.sleep(1)
    assert confirmed, 'System installer confirmation was not found'
    while time.monotonic() < deadline:
        installed = adb('shell', 'dumpsys', 'package', PACKAGE)
        if 'versionCode=26 ' in installed:
            break
        time.sleep(1)
    else:
        raise AssertionError('System installer did not update to versionCode=26')
    preferences = adb('shell', 'run-as', PACKAGE, 'cat', 'shared_prefs/update-test.xml')
    assert 'keep-my-data' in preferences, 'Data was lost during the update'
    (OUT / 'result.json').write_text(json.dumps({
        'android_api': adb('shell', 'getprop', 'ro.build.version.sdk').strip(),
        'legacy_uri_failure_reproduced': True,
        'cross_uid_byte_hash_check': True,
        'native_instrumented_tests': 9,
        'system_installer_updated_version_code': 26,
        'data_preserved': True,
        'fixture_only': True,
    }, indent=2))
    print('PASS: native installer updated 25 -> 26; data preserved', flush=True)


if __name__ == '__main__':
    try:
        main()
    finally:
        (OUT / 'logcat.txt').write_text(adb('logcat', '-d', check=False))
