/**
 * Generates public/models/mezone-device.gltf — the little phone used by the
 * homepage 3D scene. Written as a script so the model is reproducible and the
 * geometry is real (boxes with flat normals), not a placeholder.
 *
 *   node scripts/make-model.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

function box(size, centre = [0, 0, 0]) {
  const [w, h, d] = size.map((value) => value / 2);
  const [cx, cy, cz] = centre;

  const faces = [
    { normal: [0, 0, 1], corners: [[-w, -h, d], [w, -h, d], [w, h, d], [-w, h, d]] },
    { normal: [0, 0, -1], corners: [[w, -h, -d], [-w, -h, -d], [-w, h, -d], [w, h, -d]] },
    { normal: [1, 0, 0], corners: [[w, -h, d], [w, -h, -d], [w, h, -d], [w, h, d]] },
    { normal: [-1, 0, 0], corners: [[-w, -h, -d], [-w, -h, d], [-w, h, d], [-w, h, -d]] },
    { normal: [0, 1, 0], corners: [[-w, h, d], [w, h, d], [w, h, -d], [-w, h, -d]] },
    { normal: [0, -1, 0], corners: [[-w, -h, -d], [w, -h, -d], [w, -h, d], [-w, -h, d]] },
  ];

  const positions = [];
  const normals = [];
  const push = (point) => positions.push(point[0] + cx, point[1] + cy, point[2] + cz);

  for (const face of faces) {
    const [a, b, c, dd] = face.corners;
    for (const point of [a, b, c, a, c, dd]) {
      push(point);
      normals.push(...face.normal);
    }
  }

  return { positions, normals };
}

const parts = [
  { name: 'body', geometry: box([0.62, 1.26, 0.1]), colour: [0.659, 0.263, 0.122, 1], roughness: 0.45 },
  { name: 'screen', geometry: box([0.54, 1.1, 0.02], [0, 0, 0.06]), colour: [0.106, 0.094, 0.078, 1], roughness: 0.2 },
  { name: 'tile', geometry: box([0.26, 0.26, 0.26], [0.52, 0.62, 0.2]), colour: [0.961, 0.945, 0.917, 1], roughness: 0.35 },
  { name: 'tile2', geometry: box([0.16, 0.16, 0.16], [-0.5, -0.62, 0.22]), colour: [0.961, 0.945, 0.917, 1], roughness: 0.35 },
];

const accessors = [];
const bufferViews = [];
const meshes = [];
const nodes = [];
const materials = [];
const chunks = [];
let offset = 0;

function appendView(values) {
  const buffer = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => buffer.writeFloatLE(value, index * 4));
  const padded = Buffer.concat([buffer, Buffer.alloc((4 - (buffer.length % 4)) % 4)]);
  bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: buffer.length });
  chunks.push(padded);
  offset += padded.length;
  return bufferViews.length - 1;
}

for (const part of parts) {
  const { positions, normals } = part.geometry;

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], positions[i + axis]);
      max[axis] = Math.max(max[axis], positions[i + axis]);
    }
  }

  const positionAccessor = accessors.length;
  accessors.push({
    bufferView: appendView(positions),
    componentType: 5126,
    count: positions.length / 3,
    type: 'VEC3',
    min,
    max,
  });
  const normalAccessor = accessors.length;
  accessors.push({ bufferView: appendView(normals), componentType: 5126, count: normals.length / 3, type: 'VEC3' });

  meshes.push({ name: part.name, primitives: [{ attributes: { POSITION: positionAccessor, NORMAL: normalAccessor }, material: materials.length }] });
  materials.push({
    name: `${part.name}-material`,
    pbrMetallicRoughness: {
      baseColorFactor: part.colour,
      metallicFactor: 0.05,
      roughnessFactor: part.roughness,
    },
  });
  nodes.push({ mesh: meshes.length - 1, name: part.name });
}

const binary = Buffer.concat(chunks);

const gltf = {
  asset: { version: '2.0', generator: 'MezoneApps model generator' },
  scene: 0,
  scenes: [{ nodes: nodes.map((_, index) => index) }],
  nodes,
  meshes,
  materials,
  accessors,
  bufferViews,
  buffers: [
    {
      byteLength: binary.length,
      uri: `data:application/octet-stream;base64,${binary.toString('base64')}`,
    },
  ],
};

const target = path.join(process.cwd(), 'public', 'models', 'mezone-device.gltf');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(gltf));

console.log(`wrote ${path.relative(process.cwd(), target)} (${(fs.statSync(target).size / 1024).toFixed(1)} kB)`);
