# Quickstart

This document explains how to utilize the generated icons and favicon in the FullBloom workspace.

## Applying the Icons

1. **Locate the assets**: The generated assets will be placed in the `public/` directory of your frontend application(s), such as `apps/001-order-management/frontend/public/`.
   
2. **Verify HTML references**: Ensure that your `index.html` file located in the root of your frontend application contains the correct `<link>` tags in the `<head>` section:
   ```html
   <link rel="icon" type="image/x-icon" href="/favicon.ico" />
   <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
   <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
   <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
   ```

3. **Testing**: Run the local development server (e.g., `npm run dev` in the frontend directory) and open the application in a web browser. Verify that the favicon appears in the browser tab.

## Regeneration

If the source image changes, re-run the image processing script/task to overwrite the existing files in the `public/` directory.
