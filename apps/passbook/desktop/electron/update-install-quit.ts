let updateInstallQuitPending = false;

export function markUpdateInstallQuitPending() {
  updateInstallQuitPending = true;
}

export function isUpdateInstallQuitPending() {
  return updateInstallQuitPending;
}

export function clearUpdateInstallQuitPending() {
  updateInstallQuitPending = false;
}
