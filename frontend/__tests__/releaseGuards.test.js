// Release-build preconditions that are not covered by rendering tests.
// AAPT2 compiles bundled images by extension, so a mislabelled asset breaks
// only the release build; and the manifest security attributes are easy to
// lose in a merge. These assertions run in the normal Jest suite.
const fs = require('fs');
const path = require('path');

const { imageExtensionMismatch } = require('../src/utils/assetIntegrity');

const projectRoot = path.join(__dirname, '..');
const assetDir = path.join(projectRoot, 'assets');
const manifestPath = path.join(
  projectRoot,
  'android',
  'app',
  'src',
  'main',
  'AndroidManifest.xml',
);

describe('bundled image assets', () => {
  const images = fs
    .readdirSync(assetDir)
    .filter((name) => /\.(png|jpe?g|webp|gif)$/i.test(name))
    .sort();

  test('the asset directory contains images', () => {
    expect(images.length).toBeGreaterThan(0);
  });

  test.each(images)('%s matches its file extension', (name) => {
    const bytes = fs.readFileSync(path.join(assetDir, name));
    expect(imageExtensionMismatch(name, bytes)).toBeNull();
  });
});

describe('Android release manifest policy', () => {
  const manifest = fs.readFileSync(manifestPath, 'utf8');

  test('cleartext, backup, and data extraction are locked down', () => {
    expect(manifest).toMatch(/android:usesCleartextTraffic="false"/);
    expect(manifest).toMatch(/android:allowBackup="false"/);
    expect(manifest).toMatch(/android:fullBackupContent="false"/);
    expect(manifest).toMatch(/android:dataExtractionRules="@xml\/data_extraction_rules"/);
    expect(manifest).not.toMatch(/android:usesCleartextTraffic="true"/);
    expect(manifest).not.toMatch(/android:debuggable="true"/);
  });

  test('the reset App Link is exact-scoped to https://cookmitra.org/reset-password', () => {
    expect(manifest).toMatch(/android:scheme="https"/);
    expect(manifest).toMatch(/android:host="cookmitra\.org"/);
    expect(manifest).toMatch(/android:path="\/reset-password"/);
    // pathPrefix would also claim /reset-password-help and friends.
    expect(manifest).not.toMatch(/android:pathPrefix=/);
  });

  test('haptic alerts have the VIBRATE permission', () => {
    expect(manifest).toMatch(/android\.permission\.VIBRATE/);
  });

  test('only the launcher activity is exported', () => {
    const exported = manifest.match(/android:exported="true"/g) || [];
    expect(exported).toHaveLength(1);
  });

  test('no debug-only components leak into the main manifest', () => {
    expect(manifest).not.toMatch(/android:name="\.debug\./);
    expect(manifest).not.toMatch(/com\.facebook\.react\.devsupport/);
  });
});
