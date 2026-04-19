# Data Model

*Note: This feature involves static visual assets and HTML meta tags rather than backend database entities.*

## Static Assets

- **Favicon (.ico)**: A multi-size icon file usually containing 16x16 and 32x32 pixel representations. Used by desktop browsers for tabs and bookmarks.
- **Apple Touch Icon (.png)**: A 180x180 pixel PNG used by iOS devices when a website is added to the home screen.
- **Web App Manifest Icons (.png)**: PNG images (typically 192x192 and 512x512 pixels) referenced in a `manifest.json` for Android and PWA (Progressive Web App) home screen installations.

## HTML Meta Tags

The `index.html` of the frontend application will include the following entities:

```html
<!-- In the <head> section -->
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
<link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
```
