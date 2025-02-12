import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";
import { FBXLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/FBXLoader.js";
import { EffectComposer } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/postprocessing/UnrealBloomPass.js";

// Scene setup
const scene = new THREE.Scene();

// Set up the orthographic camera
const aspect = window.innerWidth / window.innerHeight;
const frustumSize = 20;
const camera = new THREE.OrthographicCamera(
  (-frustumSize * aspect) /1, // left
  (frustumSize * aspect) / 1,  // right
  frustumSize / 1,            // top
  -frustumSize / 1,           // bottom
  1,                        // near
  20000                        // far
);
camera.position.set(-6, 11, 200); // Move the camera up along the Z-axis

const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById("container3D").appendChild(renderer.domElement);

const loader = new FBXLoader();

// Load the video element
const videoElement = document.createElement("video");
videoElement.loop = true;
videoElement.muted = true;
videoElement.autoplay = true;

const videoSources = [
  "./videos/video1.mp4",
  "./videos/video2.mp4",

  "./videos/video4.mp4",
  "./videos/video5.mp4",



  "./videos/video10.mp4",
];
let currentVideoIndex = 0;
let playbackSpeed = 0;

function playVideo(source) {
  videoElement.src = source;
  videoElement.load();
  videoElement.oncanplay = () => {
    videoElement.play();
    videoElement.playbackRate = playbackSpeed;
  };
}

playVideo(videoSources[currentVideoIndex]);

const videoTexture = new THREE.VideoTexture(videoElement);
videoTexture.minFilter = THREE.LinearFilter;
videoTexture.magFilter = THREE.LinearFilter;
videoTexture.format = THREE.RGBFormat;

const brightness = 30.0;
const videoSize = new THREE.Vector2(1, 1);

// Shader-based video material
const videoMaterial = new THREE.ShaderMaterial({
  uniforms: {
    videoTexture: { value: videoTexture },
    brightness: { value: brightness },
    offset: { value: new THREE.Vector2(1, 1) },
    videoSize: { value: videoSize }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform sampler2D videoTexture;
    uniform float brightness;
    uniform vec2 offset;
    uniform vec2 videoSize;

    void main() {
      vec2 adjustedUv = (vUv + offset) * videoSize;
      vec4 videoColor = texture2D(videoTexture, adjustedUv);
      videoColor.rgb *= brightness;
      gl_FragColor = vec4(videoColor.rgb, videoColor.a);
    }
  `
});

// Load and apply shader material to all models
const models = [];
const initialPositions = [];
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedModel = null;
let dragOffset = new THREE.Vector3();
let isDragging = false;
let returnSpeed = 0.1;
let isReturning = false;
let returnTargetPosition = null;

function loadModel(i) {
  loader.load(
    `./models/letter/secondModel/${i}.fbx`,
    (fbx) => {
      fbx.scale.set(0.09, 0.09, 1);
   fbx.rotation.set(0, 0.1, 0);


      initialPositions.push(fbx.position.clone());

      fbx.traverse((child) => {
        if (child.isMesh) {
          child.material = videoMaterial;
        }
      });

      scene.add(fbx);
      models.push(fbx);
    },
    (xhr) => console.log((xhr.loaded / xhr.total) * 100 + "% loaded"),
    (error) => console.error(error)
  );
}

// Load all 10 models
for (let i = 1; i <= 13; i++) {
  loadModel(i);
}
// Main point light (already present)
const pointLight = new THREE.PointLight(0xffffff, 20, 500);
pointLight.position.set(10, 10, 2);
scene.add(pointLight);



let offsetX = 1;
const panSpeed = 0.0009;
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.1;
bloomPass.strength = 0; // Initial glow strength
bloomPass.radius = 1;
composer.addPass(bloomPass);

function animate() {
  requestAnimationFrame(animate);

  // Compute the average position of the models
  if (models.length > 0) {
    let sumPosition = new THREE.Vector3();
    models.forEach(model => sumPosition.add(model.position));
    let avgPosition = sumPosition.divideScalar(models.length);

 
  }

  offsetX += panSpeed;
  if (offsetX > 1.0) {
    offsetX = 0;
  }

  videoMaterial.uniforms.offset.value.set(offsetX, 0);
  composer.render();

}


animate();

// Update everything when the window is resized
window.addEventListener("resize", () => {
  const aspect = window.innerWidth / window.innerHeight;

  // Preserve the camera's existing position (DO NOT reset it)
  const currentCameraPosition = camera.position.clone(); // Store the current position

  // Update camera aspect ratio and projection matrix
  camera.aspect = aspect;
  camera.updateProjectionMatrix();

  // Resize renderer properly
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  // Resize bloom effect (if used)
  composer.setSize(window.innerWidth, window.innerHeight);

  // Restore the previous camera position (so it doesn’t shift)
  camera.position.copy(currentCameraPosition);
});




// Mouse event listeners for dragging
const dragLimits = {
  minX: -20,
  maxX: 30,
  minZ: -5,
  maxZ: 5,
  minY: -20,  // Set minimum Y (keep on the ground level)
  maxY: 10    // Set a reasonable height limit for dragging
};

const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 0), 0); // A plane for dragging calculations
const planeIntersectPoint = new THREE.Vector3();

window.addEventListener("mousedown", (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(models, true);

  if (intersects.length > 0) {
    selectedModel = intersects[0].object.parent;

    // Find intersection with the drag plane
    if (raycaster.ray.intersectPlane(dragPlane, planeIntersectPoint)) {
      dragOffset.copy(planeIntersectPoint).sub(selectedModel.position);
    }

    isDragging = true;
  }
});

window.addEventListener("mousemove", (event) => {
  if (isDragging && selectedModel) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    if (raycaster.ray.intersectPlane(dragPlane, planeIntersectPoint)) {
      // Ensure dragging aligns properly with the mouse
      selectedModel.position.copy(planeIntersectPoint.sub(dragOffset));
     selectedModel.position.z = Math.max(dragLimits.minZ, Math.min(dragLimits.maxZ, selectedModel.position.z));
    }
  }
});

window.addEventListener("mouseup", () => {
  isDragging = false;
  selectedModel = null;
});

// Create a slider to switch between videos
const videoSlider = document.createElement("input");
videoSlider.type = "range";
videoSlider.min = "0";
videoSlider.max = (videoSources.length - 1).toString();
videoSlider.value = "0"; // Default value
videoSlider.style.position = "absolute";
videoSlider.style.top = "110px";
videoSlider.style.left = "10px";
videoSlider.style.zIndex = "9999";
videoSlider.style.width = "150px";
videoSlider.style.background = "gray"; // Changes the default track color (only works in some browsers)
videoSlider.style.webkitAppearance = "none"; // Removes default styling
videoSlider.style.height = "10px"; // Adjust track height
videoSlider.style.borderRadius = "10px"; // Round edges

// Create a label for the slider
const videoLabel = document.createElement("label");
videoLabel.textContent = "Video: ";
videoLabel.style.position = "absolute";
videoLabel.style.top = "80px";
videoLabel.style.left = "11px";
videoLabel.style.color = "#FFFFFF";
videoLabel.style.fontSize = "18px";
videoLabel.style.zIndex = "9999";

// Append slider and label to the document
document.body.appendChild(videoLabel);
document.body.appendChild(videoSlider);

// Event listener to update the video in real-time
videoSlider.addEventListener("input", () => {
  const newVideoIndex = parseInt(videoSlider.value);
  
  if (newVideoIndex !== currentVideoIndex) {
    currentVideoIndex = newVideoIndex;
    playVideo(videoSources[currentVideoIndex]);
    console.log(`Video changed to: ${videoSources[currentVideoIndex]}`);
  }
});

// Add Reset Button to Reset All Models
const resetButton = document.createElement("button");
resetButton.textContent = "Reset";
resetButton.style.position = "absolute";

resetButton.style.top = "30px";
resetButton.style.left = "10px";
resetButton.style.zIndex = "9999";
resetButton.style.padding = "10px 15px";
resetButton.style.fontSize = "16px";
resetButton.style.backgroundColor = "#ff5733";
resetButton.style.color = "";
resetButton.style.border = "none";
resetButton.style.cursor = "pointer";
resetButton.style.borderRadius = "400px";
resetButton.style.boxShadow = "2px 2px 4px rgba(0,0,0,0.2)";
document.body.appendChild(resetButton);

resetButton.addEventListener("click", () => {
  models.forEach((model, index) => {
    model.position.copy(initialPositions[index]);
    
    // Reset Twist Effect
    model.traverse((child) => {
      if (child.isMesh) {
        child.rotation.y = 0; // Reset rotation to default
      }
    });
  });

  // Reset Twist Slider Position
  twistSlider.value = "0";

  console.log("Models and twist effect have been reset!");
});





// Create a container for the UI elements
const uiContainer = document.createElement("div");
uiContainer.style.position = "absolute";
uiContainer.style.top = "0px";
uiContainer.style.left = "5px";
uiContainer.style.width = "150px"; 
uiContainer.style.height = "250px";// Adjust width as needed
uiContainer.style.padding = "10px";
uiContainer.style.borderRadius = "10px";
uiContainer.style.backgroundColor = "#000"; // Grey background

uiContainer.style.zIndex = "99999"; // Place below buttons but above canvas

// Append the container to the body
document.body.appendChild(uiContainer);

// Function to move existing UI elements into the container
function moveToContainer(element) {
  uiContainer.appendChild(element);
}

// Move all UI elements into the container
moveToContainer(resetButton);
moveToContainer(videoLabel);
moveToContainer(videoSlider);

// Create "Toggle Videos" button
const toggleVideosButton = document.createElement("button");
toggleVideosButton.textContent = "Off"; // Initial state (Videos Off)
toggleVideosButton.style.position = "absolute";
toggleVideosButton.style.top = "30px";
toggleVideosButton.style.left = "100px"; // Position next to Reset button
toggleVideosButton.style.zIndex = "9999";
toggleVideosButton.style.padding = "10px 15px";
toggleVideosButton.style.fontSize = "16px";
toggleVideosButton.style.backgroundColor = "#888"; // Gray color
toggleVideosButton.style.color = "#FFFFFF";
toggleVideosButton.style.border = "none";
toggleVideosButton.style.cursor = "pointer";
toggleVideosButton.style.borderRadius = "100px";

// Append button to the UI container
moveToContainer(toggleVideosButton);

// Create a simple gray material
const grayMaterial = new THREE.MeshStandardMaterial({ color: 0x000001 });

let videosAreOn = true; // Track the state



toggleVideosButton.addEventListener("click", () => {
  if (videosAreOn) {
    // Turn videos off
    videoElement.pause();
    videoElement.src = ""; // Remove video source

    // Apply gray material to all models
    models.forEach((model) => {
      model.traverse((child) => {
        if (child.isMesh) {
          child.material = grayMaterial;
        }
      });
    });

    toggleVideosButton.textContent = "On"; // Update button text
    toggleVideosButton.style.backgroundColor = "#4F7942";
    // Hide video slider, show color slider
    videoSlider.style.display = "none";
    videoLabel.style.display = "none";
    colorSlider.style.display = "block";
    colorLabel.style.display = "block";
  } else {
    // Turn videos back on
    playVideo(videoSources[currentVideoIndex]); // Restart video

    // Apply video material back to models
    models.forEach((model) => {
      model.traverse((child) => {
        if (child.isMesh) {
          child.material = videoMaterial;
        }
      });
    });

    toggleVideosButton.textContent = "Off"; // Update button text
    toggleVideosButton.style.backgroundColor = "#888";
    // Hide color slider, show video slider
    colorSlider.style.display = "none";
    colorLabel.style.display = "none";
    videoSlider.style.display = "block";
    videoLabel.style.display = "block";
  }

  videosAreOn = !videosAreOn; // Toggle state
});

// Create a color slider
const colorSlider = document.createElement("input");
colorSlider.type = "color";
colorSlider.value = "#C0C0C0"; // Default color
colorSlider.style.position = "absolute";
colorSlider.style.top = "107px";
colorSlider.style.left = "10px";
colorSlider.style.zIndex = "9999";
colorSlider.style.display = "none"; // Initially hidden
colorSlider.style.backgroundColor = "#888";
// Create a label for the color slider
const colorLabel = document.createElement("label");
colorLabel.textContent = "Text Color: ";
colorLabel.style.position = "absolute";
colorLabel.style.top = "80px";
colorLabel.style.left = "10px";
colorLabel.style.color = "#FFFFFF";
colorLabel.style.fontSize = "18px";
colorLabel.style.zIndex = "9999";
colorLabel.style.display = "none"; // Initially hidden

// Append color slider and label to the UI container
moveToContainer(colorLabel);
moveToContainer(colorSlider);

colorSlider.addEventListener("input", () => {
  const newColor = new THREE.Color(colorSlider.value);

  models.forEach((model) => {
    model.traverse((child) => {
      if (child.isMesh) {
        child.material.emissive.set(newColor); // Only change emissive color
        child.material.emissiveIntensity = 1.5; // Adjust glow effect
      }
    });
  });

  console.log("Updated emission color to:", colorSlider.value);
});

// Create a thickness slider (controls Z)
const thicknessSlider = document.createElement("input");
thicknessSlider.type = "range";
thicknessSlider.min = "1";
thicknessSlider.max = "9";
thicknessSlider.step = "0.05";
thicknessSlider.value = "1"; // Default thickness
thicknessSlider.style.position = "absolute";
thicknessSlider.style.top = "175px";
thicknessSlider.style.left = "10px";
thicknessSlider.style.zIndex = "9999";
thicknessSlider.style.width = "150px";
thicknessSlider.style.background = "gray"; // Changes the default track color (only works in some browsers)
thicknessSlider.style.webkitAppearance = "none"; // Removes default styling
thicknessSlider.style.height = "10px"; // Adjust track height
thicknessSlider.style.borderRadius = "10px"; // Round edges

// Create a label for the thickness slider
const thicknessLabel = document.createElement("label");
thicknessLabel.textContent = "Thickness:";
thicknessLabel.style.position = "absolute";
thicknessLabel.style.top = "140px";
thicknessLabel.style.left = "1px";

thicknessLabel.style.color = "#FFFFFF";
thicknessLabel.style.fontSize = "18px";
thicknessLabel.style.zIndex = "9999";

thicknessLabel.style.padding = "5px 10px";
thicknessLabel.style.borderRadius = "5px";

// Append the thickness slider and label to the body
document.body.appendChild(thicknessLabel);
document.body.appendChild(thicknessSlider);
thicknessSlider.addEventListener("input", () => {
  const newThickness = parseFloat(thicknessSlider.value);

  models.forEach((model) => {
    model.scale.z = newThickness;

    // Keep Z within bounds
    model.position.z = Math.max(dragLimits.minZ, Math.min(dragLimits.maxZ, model.position.z));
  });
 
  // Move the camera slightly to the left as thickness increases
  const maxOffset = -40; // Maximum left movement
  const minOffset = -4;   // Default position
  const normalizedValue = (newThickness - thicknessSlider.min) / (thicknessSlider.max - thicknessSlider.min);

  camera.position.x = minOffset + normalizedValue * (maxOffset - minOffset);

  console.log("Updated thickness to:", newThickness, "Camera X Position:", camera.position.x);
});



// Create a twist effect slider (adds rotation to parts of models)
const twistSlider = document.createElement("input");
twistSlider.type = "range";
twistSlider.min = "-1"; // Twist left
twistSlider.max = "1"; // Twist right
twistSlider.step = "0.05";
twistSlider.value = "0"; // Default (no twist)
twistSlider.style.position = "absolute";
twistSlider.style.top = "290px";
twistSlider.style.left = "10px";
twistSlider.style.zIndex = "9999";
twistSlider.style.width = "150px";
twistSlider.style.background = "gray"; // Changes the default track color (only works in some browsers)
twistSlider.style.webkitAppearance = "none"; // Removes default styling
twistSlider.style.height = "10px"; // Adjust track height
twistSlider.style.borderRadius = "10px"; // Round edges

// Create a label for the twist slider
const twistLabel = document.createElement("label");
twistLabel.textContent = "Rotate: ";
twistLabel.style.position = "absolute";
twistLabel.style.top = "257px";
twistLabel.style.left = "4px";
twistLabel.style.color = "#FFFFFF";
twistLabel.style.fontSize = "18px";
twistLabel.style.zIndex = "9999";

twistLabel.style.padding = "5px 10px";
twistLabel.style.borderRadius = "5px";

// Append the twist slider and label to the UI container
moveToContainer(twistLabel);
moveToContainer(twistSlider);

twistSlider.addEventListener("input", () => {
  const twistValue = parseFloat(twistSlider.value);

  models.forEach((model, index) => {
    model.traverse((child) => {
      if (child.isMesh) {
        child.rotation.y = twistValue * (index % 1 === 0 ? 1 : -1); // Alternate twist directions
      }
    });
  });

  console.log("Updated twist effect to:", twistValue);
});


// Create Bloom Intensity Slider
const bloomSlider = document.createElement("input");
bloomSlider.type = "range";
bloomSlider.min = "0"; // No bloom
bloomSlider.max = "1.5"; // Max bloom
bloomSlider.step = "0.1";
bloomSlider.value = "0"; // Default bloom intensity
bloomSlider.style.position = "absolute";
bloomSlider.style.top = "230px";
bloomSlider.style.left = "10px";
bloomSlider.style.zIndex = "9999";
bloomSlider.style.width = "150px";
bloomSlider.style.background = "gray"; // Changes the default track color (only works in some browsers)
bloomSlider.style.webkitAppearance = "none"; // Removes default styling
bloomSlider.style.height = "10px"; // Adjust track height
bloomSlider.style.borderRadius = "10px"; // Round edges

// Create a label for the Bloom Slider
const bloomLabel = document.createElement("label");
bloomLabel.textContent = "Glow: ";
bloomLabel.style.position = "absolute";
bloomLabel.style.top = "197px";
bloomLabel.style.left = "2px";
bloomLabel.style.color = "#FFFFFF";
bloomLabel.style.fontSize = "18px";
bloomLabel.style.zIndex = "9999";

bloomLabel.style.padding = "5px 10px";
bloomLabel.style.borderRadius = "5px";

// Append the slider and label to the UI container
moveToContainer(bloomLabel);
moveToContainer(bloomSlider);

// Update bloom effect based on slider value
bloomSlider.addEventListener("input", () => {
  const bloomIntensity = parseFloat(bloomSlider.value);
  bloomPass.strength = bloomIntensity;
  console.log("Updated bloom intensity to:", bloomIntensity);
});

// Apply the font globally to all text elements
document.body.style.fontFamily = 'monospace';  // Use the built-in monospace font

// Apply the font to all existing UI elements (like buttons, sliders, labels)
const allUIElements = document.querySelectorAll("button, input, label");
allUIElements.forEach((element) => {
  element.style.fontFamily = 'monospace';  // Apply monospace font
  element.style.fontWeight = '100';  // Set regular weight
  element.style.fontStyle = 'normal';  // Set normal style (not italic)
});


// Create the pull light chord button for the UI container
const dropdownButton = document.createElement("div");
dropdownButton.style.position = "absolute";
dropdownButton.style.left = "2%"; // Center horizontally
dropdownButton.style.top = "50%"; // Position in the middle
dropdownButton.style.transform = "translate(-50%, -50%)"; // Adjust to center
dropdownButton.style.zIndex = "9999";
dropdownButton.style.width = "0"; // Required for triangle shape
dropdownButton.style.height = "0"; // Required for triangle shape
dropdownButton.style.cursor = "pointer";
// Create the cone shape using border tricks
dropdownButton.style.borderLeft = "20px solid transparent"; // Left side transparent
dropdownButton.style.borderRight = "20px solid transparent"; // Right side transparent
dropdownButton.style.borderBottom = "40px solid #ccc"; // Cone color



// Create the vertical pull chord line
const pullChordLine = document.createElement("div");
pullChordLine.style.position = "absolute";
pullChordLine.style.left = "1.9%"; // Center the line horizontally with respect to the button
pullChordLine.style.zIndex = "9999";
pullChordLine.style.width = "3px"; // Line width
pullChordLine.style.backgroundColor = "#fff"; // Same color as the button to match the theme
pullChordLine.style.top = "-50%"; // Position the line right below the button
pullChordLine.style.height = "100%"; // Initially visible line length

// Append the line to the document body
document.body.appendChild(pullChordLine);
pullChordLine.style.background = "repeating-linear-gradient(transparent, transparent 4px, white 4px, white 8px)";

// Add transition for smooth movement of the button and the line
dropdownButton.style.transition = "top 1s ease-in-out"; // Smooth transition for the 'top' property
pullChordLine.style.transition = "height 1s ease-in-out"; // Smooth transition for the 'height' property

// Append the dropdown button to the document
document.body.appendChild(dropdownButton);

// Variable to track the state of the button (pulled down or up)
let isPulledDown = true;

// Function to toggle the position of the button
function toggleButtonPosition() {
    if (isPulledDown) {
        // Move the button up (simulate pulling the chord up)
        dropdownButton.style.top = "80%"; // Example position, adjust as needed
        pullChordLine.style.height = "130%"; // Stretch the line as the button moves up
    } else {
        // Move the button back down (simulate the chord pulling down)
        dropdownButton.style.top = "50%"; // Example initial position
        pullChordLine.style.height = "100%"; // Reset the line height as the button moves down
    }

    // Toggle the state
    isPulledDown = !isPulledDown;
}

// Add event listener to handle the click or pull action
dropdownButton.addEventListener("click", toggleButtonPosition);

// Initially hide the UI container (sliders and controls)
uiContainer.style.transition = "height 0.8s ease-in-out"; // Smooth height transition
uiContainer.style.height = "0px"; // Initially collapsed
uiContainer.style.overflow = "hidden"; // Hide overflow content when collapsed

// Track whether the UI is expanded or collapsed
let isContainerOpen = false;

dropdownButton.addEventListener("click", () => {
  if (isContainerOpen) {
    // Collapse the container (hide the sliders)
    uiContainer.style.height = "0%";
  } else {
    // Expand the container (show the sliders)
    uiContainer.style.height = "60%"; // Set to the container's full height
  }

  // Toggle the state
  isContainerOpen = !isContainerOpen;
});

// Now move the existing UI elements into the container as before
moveToContainer(resetButton);
moveToContainer(videoLabel);
moveToContainer(videoSlider);
moveToContainer(colorLabel);
moveToContainer(colorSlider);
moveToContainer(thicknessLabel);
moveToContainer(thicknessSlider);
moveToContainer(twistLabel);
moveToContainer(twistSlider);
moveToContainer(bloomLabel);
moveToContainer(bloomSlider);
moveToContainer(toggleVideosButton);

// Create a background color slider
const bgColorSlider = document.createElement("input");
bgColorSlider.type = "color";
bgColorSlider.value = "#222222"; // Default background color
bgColorSlider.style.position = "absolute";
bgColorSlider.style.top = "345px";
bgColorSlider.style.left = "80px";
bgColorSlider.style.zIndex = "9999";
bgColorSlider.style.backgroundColor = "#888";

// Create a label for the background color slider
const bgColorLabel = document.createElement("label");
bgColorLabel.textContent = "Background Color: ";
bgColorLabel.style.position = "absolute";
bgColorLabel.style.top = "320px";
bgColorLabel.style.left = "10px";
bgColorLabel.style.color = "#FFFFFF";
bgColorLabel.style.fontSize = "18px";
bgColorLabel.style.zIndex = "9999";

// Append background color slider and label
moveToContainer(bgColorLabel);
moveToContainer(bgColorSlider);

// Change background color when slider moves
bgColorSlider.addEventListener("input", () => {
  scene.background = new THREE.Color(bgColorSlider.value);
  console.log("Updated background color to:", bgColorSlider.value);
});

// Create a button to randomize 3D models' positions
const randomizeButton = document.createElement("button");
randomizeButton.textContent = "Randomize Position";
randomizeButton.style.position = "absolute";
randomizeButton.style.top = "400px";
randomizeButton.style.left = "3px";
randomizeButton.style.zIndex = "9999";
randomizeButton.style.padding = "7px";
randomizeButton.style.fontSize = "16px";
randomizeButton.style.cursor = "pointer";
randomizeButton.style.borderRadius = "10px"; // Round edges
randomizeButton.style.color = "white";
randomizeButton.style.background = "gray";
// Append the button to the UI
moveToContainer(randomizeButton);

// Function to check for overlapping models
function isOverlapping(newPos, existingPositions, minDistance) {
  for (let pos of existingPositions) {
    const distance = newPos.distanceTo(pos);
    if (distance < minDistance) {
      return true; // Overlap detected
    }
  }
  return false;
}

// Randomize models' positions when button is clicked
randomizeButton.addEventListener("click", () => {
  const existingPositions = [];
  const minDistance = 2; // Minimum distance between models

  models.forEach((model) => {
    let newPosition;
    let attempts = 0;

    do {
      newPosition = new THREE.Vector3(
        (Math.random() - 0.5) * 10, // Random X within -5 to 5
        (Math.random() - 0.5) * 5,  // Random Y within -2.5 to 2.5
        (Math.random() - 0.5) * 10  // Random Z within -5 to 5
      );
      attempts++;
    } while (isOverlapping(newPosition, existingPositions, minDistance) && attempts < 20);

    model.position.set(newPosition.x, newPosition.y, newPosition.z);
    existingPositions.push(newPosition);
  });

  console.log("Randomized model positions!");
});
