export class AircraftVisualSystem {
  update(dt, flight, cameraMode = 'first') {
    const safeDt = Math.max(0, Math.min(0.1, dt || 0));
    this.elapsed += safeDt;
    this.cameraMode = cameraMode;
    this.cockpitRoot.visible = cameraMode === 'cockpit';
    this.externalRoot.visible = cameraMode === 'third' && Boolean(flight?.position);
    if (this.externalRoot.visible) {
      this.externalRoot.position.copy(flight.position);
      if (flight.attitude?.isQuaternion) this.externalRoot.quaternion.copy(flight.attitude);
    }
    const speed = Math.max(0, Number(flight?.speed) || 0);
    const propeller = this.externalModel?.userData?.propeller;
    if (propeller) {
      propeller.rotation.z += safeDt * (18 + Math.min(112, speed * 0.50));
    }
    const propellerBlur = this.externalModel?.userData?.propellerBlur;
    if (propellerBlur?.material) {
      const blurAmount = Math.max(0, Math.min(1, (speed - 18) / 95));
      propellerBlur.material.opacity = blurAmount * 0.18;
    }
    const instruments = this.cockpitModel?.userData?.instruments || [];
    if (instruments[0]) instruments[0].userData.needle.rotation.z = -1.8 + Math.min(3.6, speed / 160 * 3.6);
    if (instruments[1]) instruments[1].userData.needle.rotation.z = -1.4 + Math.min(2.8, Math.max(0, flight?.position?.y || 0) / 1800 * 2.8);
    if (instruments[2]) instruments[2].userData.needle.rotation.z = -1.4 + Math.min(2.8, speed / 120 * 2.8);
    const flutter = Math.max(0, Math.min(1, (speed - 150) / 450));
    this.cockpitRoot.position.x = Math.sin(this.elapsed * 17) * flutter * 0.0018;
    this.cockpitRoot.position.y = Math.sin(this.elapsed * 13) * flutter * 0.0012;
  }
  dispose() {}
}
