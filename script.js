const scene = document.querySelector('.envelope-scene');
const openButton = document.querySelector('.open-button');
const birdSwarm = document.querySelector('.bird-swarm');
let revealTimer;

scene.classList.remove('is-open');
document.body.classList.remove('show-invitation');

const birdPaths = [
  [-46,-34],[-34,-54],[-18,-62],[5,-58],[24,-49],[44,-31],
  [-55,-12],[-42,7],[-30,31],[-12,48],[10,54],[31,38],[51,17],
  [-52,25],[-37,49],[-16,65],[7,68],[29,57],[48,39],
  [-61,-43],[-26,-73],[20,-70],[58,-46],[-65,4],[64,2]
];

birdPaths.forEach(([x, y], index) => {
  const bird = document.createElement('span');
  bird.style.setProperty('--fly-x', `${x}vw`);
  bird.style.setProperty('--fly-y', `${y}vh`);
  bird.style.setProperty('--bird-scale', 0.55 + (index % 6) * 0.12);
  bird.style.setProperty('--bird-rotation', `${-24 + (index * 17) % 49}deg`);
  bird.style.setProperty('--bird-delay', `${(index % 8) * 0.045}s`);
  birdSwarm.appendChild(bird);
});

const startReveal = () => {
  if (!scene.classList.contains('is-open')) return;
  document.body.classList.add('show-invitation');
  birdSwarm.classList.remove('is-flying');
  void birdSwarm.offsetWidth;
  birdSwarm.classList.add('is-flying');
};

const openEnvelope = () => {
  if (scene.classList.contains('is-open')) return;
  scene.classList.add('is-open');
  window.clearTimeout(revealTimer);
  revealTimer = window.setTimeout(startReveal, 1500);
};

openButton.addEventListener('click', openEnvelope);

scene.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch') return;
  const x = event.clientX / window.innerWidth;
  const y = event.clientY / window.innerHeight;
  scene.style.setProperty('--light-x', `${x * 100}%`);
  scene.style.setProperty('--light-y', `${y * 100}%`);
  scene.style.setProperty('--shift-x', `${(x - 0.5) * 3}px`);
  scene.style.setProperty('--shift-x-reverse', `${(0.5 - x) * 3}px`);
  scene.style.setProperty('--shift-y', `${(y - 0.5) * 1.5}px`);
});

scene.addEventListener('pointerleave', () => {
  scene.style.setProperty('--light-x', '35%');
  scene.style.setProperty('--light-y', '18%');
  scene.style.setProperty('--shift-x', '0px');
  scene.style.setProperty('--shift-x-reverse', '0px');
  scene.style.setProperty('--shift-y', '0px');
});

document.querySelectorAll('.scratch-circle').forEach((circle) => {
  const canvas = circle.querySelector('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  let drawing = false;
  let revealed = false;

  const paintCover = () => {
    const size = circle.clientWidth;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * ratio;
    canvas.height = size * ratio;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const gradient = context.createRadialGradient(size * .32, size * .25, 2, size / 2, size / 2, size * .7);
    gradient.addColorStop(0, '#f7eee6');
    gradient.addColorStop(.45, '#d9c7ba');
    gradient.addColorStop(1, '#ae8e83');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    context.fillStyle = 'rgba(255,255,255,.5)';
    for (let n = 0; n < 45; n += 1) {
      context.beginPath();
      context.arc((n * 29) % size, (n * 47) % size, .5 + n % 2, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = 'rgba(112,78,75,.72)';
    context.font = `500 ${Math.max(8, size * .11)}px Manrope`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('СТЕРЕТЬ', size / 2, size / 2);
  };

  const erase = (event) => {
    if (revealed) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    context.globalCompositeOperation = 'destination-out';
    context.beginPath();
    context.arc(x, y, rect.width * .16, 0, Math.PI * 2);
    context.fill();
  };

  const checkReveal = () => {
    if (revealed) return;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = 0;
    for (let index = 3; index < pixels.length; index += 32) {
      if (pixels[index] < 40) transparent += 1;
    }
    if (transparent / (pixels.length / 32) > .48) {
      revealed = true;
      canvas.classList.add('is-cleared');
    }
  };

  canvas.addEventListener('pointerdown', (event) => {
    drawing = true;
    canvas.setPointerCapture(event.pointerId);
    erase(event);
  });
  canvas.addEventListener('pointermove', (event) => { if (drawing) erase(event); });
  canvas.addEventListener('pointerup', () => { drawing = false; checkReveal(); });
  canvas.addEventListener('pointercancel', () => { drawing = false; });

  paintCover();
});

const inviteLetter = document.querySelector('.invite-letter');
const letterObserver = new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting) {
    inviteLetter.classList.add('is-visible');
    letterObserver.disconnect();
  }
}, { threshold: 0.22 });

letterObserver.observe(inviteLetter);
