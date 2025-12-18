'use strict';

function gotKey(event) {

  var key = event.key;
  var moveSpeed = 0.3;

  console.log('Key pressed:', key);
  console.log('Camera position before:', cameraPosition);

  // Arrow keys to move camera
  switch (key) {
    case 'ArrowUp':
      event.preventDefault(); // Prevent page scroll in Safari
      cameraPosition[1] += moveSpeed; // Move up
      console.log('Moving up');
      break;
    case 'ArrowDown':
      event.preventDefault(); // Prevent page scroll in Safari
      cameraPosition[1] -= moveSpeed; // Move down
      console.log('Moving down');
      break;
    case 'ArrowLeft':
      event.preventDefault(); // Prevent page scroll in Safari
      cameraPosition[0] -= moveSpeed; // Move left
      console.log('Moving left');
      break;
    case 'ArrowRight':
      event.preventDefault(); // Prevent page scroll in Safari
      cameraPosition[0] += moveSpeed; // Move right
      console.log('Moving right');
      break;
  }

  console.log('Camera position after:', cameraPosition);

  // Redraw scene with new camera position
  draw();
}
