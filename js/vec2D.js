
export const vec2D = (x, y) => ({x: x, y: y});

export const vec2DCopy = (other) => ({x: other.x, y: other.y});

export const add = (v1, v2) => ({x: v1.x + v2.x, y: v1.y + v2.y});

export const sub = (v1, v2) => ({x: v1.x - v2.x, y: v1.y - v2.y});

export const mult = (v, scalar) => ({x: v.x * scalar, y: v.y * scalar});

export const div = (v, scalar) => scalar !== 0 
    ? { x: v.x / scalar, y: v.y / scalar } 
    : { x: 0, y: 0 };

export const magSq = (v) => v.x * v.x + v.y * v.y;

export const mag = (v) => Math.sqrt(magSq(v));

export const norm = (v) => {
  const m = mag(v);
  return m > 0 ? div(v, m) : vec2D(0, 0);
};

export const dist = (v1, v2) => mag(sub(v1, v2));

export const distSq = (v1, v2) => {
    const dx = v1.x - v2.x;
    const dy = v1.y - v2.y;
    return dx * dx + dy * dy;
};

export const dot = (v1, v2) => v1.x * v2.x + v1.y * v2.y;

export const lerp = (v1, v2, t) => ({
    x: v1.x + (v2.x - v1.x) * t,
    y: v1.y + (v2.y - v1.y) * t
});

export const angle = (v) => Math.atan2(v.y, v.x);

export const setAdd = (v1, v2) => {
    v1.x += v2.x;
    v1.y += v2.y;
    return v1;
};

export const setSub = (v1, v2) => {
    v1.x -= v2.x;
    v1.y -= v2.y;
    return v1;
};

export const setMult = (v, scalar) => {
    v.x *= scalar;
    v.y *= scalar;
    return v;
};

export const setDiv = (v, scalar) => {
    if (scalar !== 0) {
      v.x /= scalar;
      v.y /= scalar;
    }
    return v;
};

export const vec2DSet = (v, x, y) => {
    v.x = x;
    v.y = y;
    return v;
};

export const vec2DEqual = (v1, v2) => {
    return v1.x === v2.x && v1.y === v2.y;
};

export const intersect = (a1, a2, b1, b2) => {
    const r = sub(a2, a1); // Direction of line A
    const s = sub(b2, b1); // Direction of line B

    // 2D determinant (cross product)
    const det = r.x * s.y - r.y * s.x;

    // Parallel or collinear if determinant is 0
    if (Math.abs(det) < 1e-10) return null;

    const b1MinusA1 = sub(b1, a1);

    // t is the scalar for line A: point = a1 + t * r
    const t = (b1MinusA1.x * s.y - b1MinusA1.y * s.x) / det;

    return add(a1, mult(r, t));
};

