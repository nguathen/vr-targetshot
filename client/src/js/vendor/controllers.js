/**
 * Controllers Reference - Standard VR controller setup for Quest
 *
 * Copy this HTML snippet into your game's <a-scene> inside the player-rig:
 *
 * <a-entity id="player-rig" position="0 0 0">
 *   <a-camera id="camera" position="0 1.6 0" wasd-controls-enabled="false" look-controls>
 *     <!-- HUD elements go here (children of camera) -->
 *     <a-cursor id="game-cursor" color="#5af" fuse="false"
 *               raycaster="objects: .clickable; far: 20" visible="true"></a-cursor>
 *   </a-camera>
 *
 *   <!-- VR Controllers (Quest Touch) with Hand Models -->
 *   <a-entity id="left-hand"
 *             hand-model="hand: left"
 *             laser-controls="hand: left; model: false; lineColor: #44aaff; lineOpacity: 0.5"
 *             raycaster="objects: .clickable; far: 20"
 *             cursor="fuse: false; rayOrigin: entity"></a-entity>
 *   <a-entity id="right-hand"
 *             hand-model="hand: right"
 *             laser-controls="hand: right; model: false; lineColor: #ff4444; lineOpacity: 0.7"
 *             raycaster="objects: .clickable; far: 20"
 *             cursor="fuse: false; rayOrigin: entity"></a-entity>
 * </a-entity>
 *
 * Required scripts (in order):
 *   <script src="/framework/utils/haptics.js"></script>
 *   <script src="/framework/interaction/hand-model.js"></script>
 *
 * Hand Model Options:
 *   - hand: 'left' or 'right' (required)
 *   - color: Hand color (default: #ffd5c8 - skin tone)
 *   - modelStyle: 'lowPoly' (default), 'highPoly', or 'toon'
 *
 * Hand Model Events:
 *   - hand-grip-start: Emitted when grip/trigger pressed
 *   - hand-grip-end: Emitted when grip/trigger released
 *
 * Hand Model Global API:
 *   HandModel.grip('left');        // Animate to fist
 *   HandModel.release('left');     // Animate to open
 *   HandModel.setStyle('toon');    // Change style globally
 *   HandModel.getHand('left');     // Get hand entity
 *   HandModel.isGripping('right'); // Check grip state
 *
 * Laser Line Configuration:
 *   - lineColor: Laser beam color (default varies by hand)
 *   - lineOpacity: Laser visibility 0-1 (set to 0 to hide)
 *   - model: false hides the default controller mesh
 *
 * Notes:
 *   - Add class="clickable" to any element you want to be interactive
 *   - Use 'click' event listener on .clickable elements for interaction
 *   - hand-model displays 3D hands with grip animation (Quest 2/3 bug workaround)
 *   - raycaster far:20 gives good range for menu interaction
 *   - Cursor provides fallback for non-VR (desktop) testing
 *   - Both VR hands and desktop cursor work simultaneously
 *
 * Desktop Fallback:
 *   The a-cursor inside the camera provides mouse-based interaction
 *   for non-VR testing. Click events work on .clickable elements.
 */
