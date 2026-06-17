#!/bin/bash
# Script to package the Chrome Extension for Chrome Web Store deployment

# Exit on error
set -e

ZIP_NAME="gmail-quick-search.zip"

echo "Packaging extension into ${ZIP_NAME}..."

# Remove old zip if it exists
if [ -f "${ZIP_NAME}" ]; then
  rm "${ZIP_NAME}"
fi

# Zip only the necessary files
zip -r "${ZIP_NAME}" \
  manifest.json \
  popup.html popup.css popup.js \
  manage.html manage.css manage.js \
  images/icon_16.png \
  images/icon_48.png \
  images/icon_128.png

echo "Done! You can now upload ${ZIP_NAME} to the Chrome Web Store Developer Console."
