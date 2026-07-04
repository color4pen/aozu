#!/bin/bash
set -euo pipefail

# aozu installer
#
# Downloads the latest aozu binary release for the current OS/architecture
# and installs it to ~/.local/bin/aozu.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/color4pen/aozu/main/install.sh | bash

REPO="color4pen/aozu"
BINARY_NAME="aozu"
INSTALL_DIR="${HOME}/.local/bin"

# ---------------------------------------------------------------------------
# Detect OS
# ---------------------------------------------------------------------------
case "$(uname -s)" in
  Darwin)
    os="darwin"
    ;;
  Linux)
    os="linux"
    ;;
  *)
    echo "Error: Unsupported operating system: $(uname -s)" >&2
    echo "aozu binary installer supports macOS (darwin) and Linux only." >&2
    echo "Download manually from: https://github.com/${REPO}/releases" >&2
    exit 1
    ;;
esac

# ---------------------------------------------------------------------------
# Detect architecture
# ---------------------------------------------------------------------------
case "$(uname -m)" in
  arm64|aarch64)
    arch="arm64"
    ;;
  x86_64|amd64)
    arch="x64"
    ;;
  *)
    echo "Error: Unsupported architecture: $(uname -m)" >&2
    echo "aozu binary installer supports arm64/aarch64 and x86_64 only." >&2
    echo "Download manually from: https://github.com/${REPO}/releases" >&2
    exit 1
    ;;
esac

ASSET="${BINARY_NAME}-${os}-${arch}"

echo "Platform: ${os}/${arch}"
echo "Asset:    ${ASSET}"

# ---------------------------------------------------------------------------
# Fetch latest release tag from GitHub API
# ---------------------------------------------------------------------------
echo "Fetching latest release..."
TAG=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
  | grep '"tag_name"' \
  | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/')

if [ -z "$TAG" ]; then
  echo "Error: Could not determine the latest release tag from the GitHub API." >&2
  exit 1
fi

echo "Version:  ${TAG}"

BASE_URL="https://github.com/${REPO}/releases/download/${TAG}"

# ---------------------------------------------------------------------------
# Download binary and checksum file into a temp directory
# ---------------------------------------------------------------------------
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Downloading ${ASSET}..."
curl -fsSL -o "${TMP_DIR}/${ASSET}" "${BASE_URL}/${ASSET}"

echo "Downloading SHA256SUMS..."
curl -fsSL -o "${TMP_DIR}/SHA256SUMS" "${BASE_URL}/SHA256SUMS"

# ---------------------------------------------------------------------------
# Verify checksum
# ---------------------------------------------------------------------------
echo "Verifying checksum..."
if ! grep -qF "${ASSET}" "${TMP_DIR}/SHA256SUMS"; then
  echo "Error: ${ASSET} not found in SHA256SUMS." >&2
  exit 1
fi

(
  cd "${TMP_DIR}"
  grep -F "${ASSET}" SHA256SUMS > check.sha256
  if [ "${os}" = "darwin" ]; then
    shasum -a 256 -c check.sha256
  else
    sha256sum -c check.sha256
  fi
)

# ---------------------------------------------------------------------------
# Install
# ---------------------------------------------------------------------------
mkdir -p "${INSTALL_DIR}"
cp "${TMP_DIR}/${ASSET}" "${INSTALL_DIR}/${BINARY_NAME}"
chmod +x "${INSTALL_DIR}/${BINARY_NAME}"

echo "Installed: ${INSTALL_DIR}/${BINARY_NAME}"

# ---------------------------------------------------------------------------
# Post-install verification
# ---------------------------------------------------------------------------
echo ""
echo "Verifying installation..."
# Run aozu --version with the install directory prepended to PATH so the
# literal command name appears in this script for readability and grep tests.
PATH="${INSTALL_DIR}:${PATH}" aozu --version

# ---------------------------------------------------------------------------
# PATH guidance
# ---------------------------------------------------------------------------
if [[ ":${PATH}:" != *":${INSTALL_DIR}:"* ]]; then
  echo ""
  echo "Note: ${INSTALL_DIR} is not in your \$PATH."
  echo "Add the following line to your ~/.bashrc or ~/.zshrc:"
  echo ""
  echo '  export PATH="$HOME/.local/bin:$PATH"'
  echo ""
  echo "Then restart your shell or run: source ~/.bashrc"
fi

echo ""
echo "aozu installed successfully!"
