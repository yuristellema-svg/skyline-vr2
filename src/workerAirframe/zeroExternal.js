const disposedRoots = new WeakSet();

function copyPose(root, position, quaternion) {
  if (!root) return;
  if (position && root.position?.copy) root.position.copy(position);
  if (quaternion && root.quaternion?.copy) root.quaternion.copy(quaternion);
}

export function applySharedRenderPose({
  renderPose,
  cockpitPose = null,
  cameraMode = 'first',
  externalRoot,
  cockpitRoot,
}) {
  const position = renderPose?.position;
  const attitude = renderPose?.attitude;
  const fixedCockpitPosition = cockpitPose?.position ?? position;
  const fixedCockpitAttitude = cockpitPose?.attitude ?? attitude;

  if (externalRoot) {
    externalRoot.visible = cameraMode === 'third' && Boolean(position);
    if (externalRoot.visible) copyPose(externalRoot, position, attitude);
  }

  if (cockpitRoot) {
    cockpitRoot.visible = cameraMode === 'cockpit' && Boolean(fixedCockpitPosition);
    if (cockpitRoot.visible) copyPose(cockpitRoot, fixedCockpitPosition, fixedCockpitAttitude);
  }

  return { position, attitude, fixedCockpitPosition, fixedCockpitAttitude };
}

export function animateAirframeVisual({ model, cockpit, profile, renderPose, dt }) {
  const safeDt = Math.max(0, Math.min(0.1, Number(dt) || 0));
  const speed = Math.max(0, Number(renderPose?.speed) || 0);
  const propeller = profile?.propeller ? model?.userData?.propeller : null;
  if (propeller) propeller.rotation.z += safeDt * (18 + Math.min(118, speed * 0.52));

  const blur = model?.userData?.propellerBlur;
  if (blur?.material) blur.material.opacity = profile?.propeller
    ? Math.max(0, Math.min(0.18, (speed - 18) / 520))
    : 0;

  const instruments = cockpit?.userData?.instruments ?? [];
  const values = [
    -1.8 + Math.min(3.6, speed / 160 * 3.6),
    -1.4 + Math.min(2.8, Math.max(0, renderPose?.position?.y || 0) / 1800 * 2.8),
    -1.4 + Math.min(2.8, speed / 120 * 2.8),
  ];
  for (let index = 0; index < Math.min(instruments.length, values.length); index += 1) {
    const needle = instruments[index]?.userData?.needle;
    if (needle?.rotation) needle.rotation.z = values[index];
  }
}

export function disposeTreeOnce(root) {
  if (!root || disposedRoots.has(root)) return false;
  disposedRoots.add(root);
  const geometries = new WeakSet();
  const materials = new WeakSet();

  root.traverse?.(object => {
    const geometry = object?.geometry;
    if (geometry && !geometries.has(geometry)) {
      geometries.add(geometry);
      geometry.dispose?.();
    }
    const list = Array.isArray(object?.material)
      ? object.material
      : object?.material
        ? [object.material]
        : [];
    for (const material of list) {
      if (!material || materials.has(material)) continue;
      materials.add(material);
      material.dispose?.();
    }
  });
  return true;
}

export function poseAgreementError(a, b) {
  if (!a?.position || !b?.position || !a?.attitude || !b?.attitude) return Infinity;
  const positionError = Math.hypot(
    a.position.x - b.position.x,
    a.position.y - b.position.y,
    a.position.z - b.position.z,
  );
  const dot = Math.abs(
    a.attitude.x * b.attitude.x +
    a.attitude.y * b.attitude.y +
    a.attitude.z * b.attitude.z +
    a.attitude.w * b.attitude.w
  );
  const normA = Math.hypot(
    a.attitude.x,
    a.attitude.y,
    a.attitude.z,
    a.attitude.w,
  );
  const normB = Math.hypot(
    b.attitude.x,
    b.attitude.y,
    b.attitude.z,
    b.attitude.w,
  );
  if (normA <= 1e-12 || normB <= 1e-12) return Infinity;
  const normalizedDot = Math.min(1, dot / (normA * normB));
  return positionError + Math.max(0, 1 - normalizedDot);
}
