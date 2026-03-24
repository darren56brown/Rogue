
export const vec2D = (x = 0, y = 0) => ({x: x, y: y});

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