
class Octree {

	constructor(position, size, accuracy) {
		this.maxDistance = Math.max(size.x, Math.max(size.y, size.z));
		this.accuracy = 0;
		this.root = new Cell(this, position, size, 0);
	}

	/*export function Octree(position, size, accuracy) {
		this.maxDistance = Math.max(size.x, Math.max(size.y, size.z));
		this.accuracy = 0;
		this.root = new Octree.Cell(this, position, size, 0);
	}*/

	fromBoundingBox(bbox) {
		return new Octree(bbox.min.clone(), bbox.getSize().clone());
	};

	MaxLevel = 8;

	add(p, data) {
		this.root.add(p, data);
	};

	has(p) {
		return this.root.has(p);
	};

	findNearestPoint(p, options) {
		options.includeData = options.includeData ? options.includeData : false;
		options.bestDist = options.maxDist ? options.maxDist : Infinity;
		options.notSelf = options.notSelf ? options.notSelf : false;

		var result = this.root.findNearestPoint(p, options);
		if (result) {
			if (options.includeData) return result;
			else return result.point;
		}
		else return null;
	};

	findNearbyPoints(p, r, options) {
		options = options || {};
		var result = { points: [], data: [] };
		this.root.findNearbyPoints(p, r, result, options);
		return result;
	};

	getAllCellsAtLevel(cell, level, result) {
		if (typeof level == 'undefined') {
			level = cell;
			cell = this.root;
		}
		result = result || [];
		if (cell.level == level) {
			if (cell.points.length > 0) {
				result.push(cell);
			}
			return result;
		} else {
			cell.children.forEach(function (child) {
				this.getAllCellsAtLevel(child, level, result);
			}.bind(this));
			return result;
		}
	};
}

class Cell {
	constructor(tree, position, size, level) {
		this.tree = tree;
		this.position = position;
		this.size = size;
		this.level = level;
		this.points = [];
		this.data = [];
		this.temp = new Vec3(); //temp vector for distance calculation
		this.children = [];
	};

	has(p) {
		if (!this.contains(p))
			return null;
		if (this.children.length > 0) {
			for (var i = 0; i < this.children.length; i++) {
				var duplicate = this.children[i].has(p);
				if (duplicate) {
					return duplicate;
				}
			}
			return null;
		} else {
			var minDistSqrt = this.tree.accuracy * this.tree.accuracy;
			for (var i = 0; i < this.points.length; i++) {
				var o = this.points[i];
				var distSq = p.squareDistance(o);
				if (distSq <= minDistSqrt) {
					return o;
				}
			}
			return null;
		}
	};

	add(p, data) {
		this.points.push(p);
		this.data.push(data);
		if (this.children.length > 0) {
			this.addToChildren(p, data);
		} else {
			if (this.points.length > 1 && this.level < Octree.MaxLevel) {
				this.split();
			}
		}
	};

	addToChildren(p, data) {
		for (var i = 0; i < this.children.length; i++) {
			if (this.children[i].contains(p)) {
				this.children[i].add(p, data);
				break;
			}
		}
	};

	contains(p) {
		return p.x >= this.position.x - this.tree.accuracy
			&& p.y >= this.position.y - this.tree.accuracy
			&& p.z >= this.position.z - this.tree.accuracy
			&& p.x < this.position.x + this.size.x + this.tree.accuracy
			&& p.y < this.position.y + this.size.y + this.tree.accuracy
			&& p.z < this.position.z + this.size.z + this.tree.accuracy;
	};

	split() {
		var x = this.position.x;
		var y = this.position.y;
		var z = this.position.z;
		var w2 = this.size.x / 2;
		var h2 = this.size.y / 2;
		var d2 = this.size.z / 2;
		this.children.push(new Octree.Cell(this.tree, Vec3.create(x, y, z), Vec3.create(w2, h2, d2), this.level + 1));
		this.children.push(new Octree.Cell(this.tree, Vec3.create(x + w2, y, z), Vec3.create(w2, h2, d2), this.level + 1));
		this.children.push(new Octree.Cell(this.tree, Vec3.create(x, y, z + d2), Vec3.create(w2, h2, d2), this.level + 1));
		this.children.push(new Octree.Cell(this.tree, Vec3.create(x + w2, y, z + d2), Vec3.create(w2, h2, d2), this.level + 1));
		this.children.push(new Octree.Cell(this.tree, Vec3.create(x, y + h2, z), Vec3.create(w2, h2, d2), this.level + 1));
		this.children.push(new Octree.Cell(this.tree, Vec3.create(x + w2, y + h2, z), Vec3.create(w2, h2, d2), this.level + 1));
		this.children.push(new Octree.Cell(this.tree, Vec3.create(x, y + h2, z + d2), Vec3.create(w2, h2, d2), this.level + 1));
		this.children.push(new Octree.Cell(this.tree, Vec3.create(x + w2, y + h2, z + d2), Vec3.create(w2, h2, d2), this.level + 1));
		for (var i = 0; i < this.points.length; i++) {
			this.addToChildren(this.points[i], this.data[i]);
		}
	};

	squareDistanceToCenter(p) {
		var dx = p.x - (this.position.x + this.size.x / 2);
		var dy = p.y - (this.position.y + this.size.y / 2);
		var dz = p.z - (this.position.z + this.size.z / 2);
		return dx * dx + dy * dy + dz * dz;
	}

	findNearestPoint(p, options) {
		var nearest = null;
		var nearestData = null;
		var bestDist = options.bestDist;

		if (this.points.length > 0 && this.children.length == 0) {
			for (var i = 0; i < this.points.length; i++) {
				var dist = this.points[i].distance(p);
				if (dist <= bestDist) {
					if (dist == 0 && options.notSelf)
						continue;
					bestDist = dist;
					nearest = this.points[i];
					nearestData = this.data[i];
				}
			}
		}

		var children = this.children;

		var children = this.children
			.map(function (child) { return { child: child, dist: child.squareDistanceToCenter(p) } })
			.sort(function (a, b) { return a.dist - b.dist; })
			.map(function (c) { return c.child; });

		if (children.length > 0) {
			for (var i = 0; i < children.length; i++) {
				var child = children[i];
				if (child.points.length > 0) {
					if (p.x < child.position.x - bestDist || p.x > child.position.x + child.size.x + bestDist ||
						p.y < child.position.y - bestDist || p.y > child.position.y + child.size.y + bestDist ||
						p.z < child.position.z - bestDist || p.z > child.position.z + child.size.z + bestDist
					) {
						continue;
					}
					var childNearest = child.findNearestPoint(p, options);
					if (!childNearest || !childNearest.point) {
						continue;
					}
					var childNearestDist = childNearest.point.distance(p);
					if (childNearestDist < bestDist) {
						nearest = childNearest.point;
						bestDist = childNearestDist;
						nearestData = childNearest.data;
					}
				}
			}
		}
		return {
			point: nearest,
			data: nearestData
		}
	};

	findNearbyPoints(p, r, result, options) {
		if (this.points.length > 0 && this.children.length == 0) {
			for (var i = 0; i < this.points.length; i++) {
				var dist = this.points[i].distance(p);
				if (dist <= r) {
					if (dist == 0 && options.notSelf)
						continue;
					result.points.push(this.points[i]);
					if (options.includeData) result.data.push(this.data[i]);
				}
			}
		}
		var children = this.children;

		if (children.length > 0) {
			for (var i = 0; i < children.length; i++) {
				var child = children[i];
				if (child.points.length > 0) {
					if (p.x < child.position.x - r || p.x > child.position.x + child.size.x + r ||
						p.y < child.position.y - r || p.y > child.position.y + child.size.y + r ||
						p.z < child.position.z - r || p.z > child.position.z + child.size.z + r
					) {
						continue;
					}
					child.findNearbyPoints(p, r, result, options);
				}
			}
		}
	};
}

class Vec3 {
	constructor(x, y, z) {
		this.x = x != null ? x : 0;
		this.y = y != null ? y : 0;
		this.z = z != null ? z : 0;

	}
 
	create(x, y, z) {
		return new Vec3(x, y, z);
	  };

    Zero() {
		return new Vec3(0, 0, 0);
	}


	  fromArray(a) {
		return new Vec3(a[0], a[1], a[2]);
	  }

	  set(x, y, z) {
		this.x = x;
		this.y = y;
		this.z = z;
		return this;
	  };

	  setVec3(v) {
		this.x = v.x;
		this.y = v.y;
		this.z = v.z;
		return this;
	  };

	  equals(v, tolerance) {
		if (tolerance == undefined) {
		  tolerance = 0.0000001;
		}
		return (Math.abs(v.x - this.x) <= tolerance) && (Math.abs(v.y - this.y) <= tolerance) && (Math.abs(v.z - this.z) <= tolerance);
	  };

	  add(v) {
		this.x += v.x;
		this.y += v.y;
		this.z += v.z;
		return this;
	  };
	  sub(v) {
		this.x -= v.x;
		this.y -= v.y;
		this.z -= v.z;
		return this;
	  };
	  scale(f) {
		this.x *= f;
		this.y *= f;
		this.z *= f;
		return this;
	  };

	  distance(v) {
		var dx = v.x - this.x;
		var dy = v.y - this.y;
		var dz = v.z - this.z;
		return Math.sqrt(dx * dx + dy * dy + dz * dz);
	  };

	  squareDistance(v) {
		var dx = v.x - this.x;
		var dy = v.y - this.y;
		var dz = v.z - this.z;
		return dx * dx + dy * dy + dz * dz;
	  };

	  simpleDistance(v) {
		var dx = Math.abs(v.x - this.x);
		var dy = Math.abs(v.y - this.y);
		var dz = Math.abs(v.z - this.z);
		return Math.min(dx, dy, dz);
	  };

	  copy(v) {
		this.x = v.x;
		this.y = v.y;
		this.z = v.z;
		return this;
	  };

	  clone() {
		return new Vec3(this.x, this.y, this.z);
	  };
	  dup() {
		return this.clone();
	  };
	  dot(b) {
		return this.x * b.x + this.y * b.y + this.z * b.z;
	  };

	  cross(v) {
		var x = this.x;
		var y = this.y;
		var z = this.z;
		var vx = v.x;
		var vy = v.y;
		var vz = v.z;
		this.x = y * vz - z * vy;
		this.y = z * vx - x * vz;
		this.z = x * vy - y * vx;
		return this;
	  };
	  asAdd(a, b) {
		this.x = a.x + b.x;
		this.y = a.y + b.y;
		this.z = a.z + b.z;
		return this;
	  };
	  asSub(a, b) {
		this.x = a.x - b.x;
		this.y = a.y - b.y;
		this.z = a.z - b.z;
		return this;
	  };
	  asCross(a, b) {
		return this.copy(a).cross(b);
	  };
	  addScaled(a, f) {
		this.x += a.x * f;
		this.y += a.y * f;
		this.z += a.z * f;
		return this;
	  };

	  length() {
		return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
	  };

	  lengthSquared() {
		return this.x * this.x + this.y * this.y + this.z * this.z;
	  };
	  normalize() {
		var len = this.length();
		if (len > 0) {
		  this.scale(1 / len);
		}
		return this;
	  };
	  limit(s) {
		var len = this.length();
	  
		if (len > s && len > 0) {
		  this.scale(s / len);
		}
	  
		return this;
	  };
	  lerp(v, t) {
		this.x = this.x + (v.x - this.x) * t;
		this.y = this.y + (v.y - this.y) * t;
		this.z = this.z + (v.z - this.z) * t;
		return this;
	  }
	  transformMat4(m) {
		var x = m.a14 + m.a11 * this.x + m.a12 * this.y + m.a13 * this.z;
		var y = m.a24 + m.a21 * this.x + m.a22 * this.y + m.a23 * this.z;
		var z = m.a34 + m.a31 * this.x + m.a32 * this.y + m.a33 * this.z;
		this.x = x;
		this.y = y;
		this.z = z;
		return this;
	  };
	  transformQuat(q) {
		var x = this.x;
		var y = this.y;
		var z = this.z;
		var qx = q.x;
		var qy = q.y;
		var qz = q.z;
		var qw = q.w;
		var ix = qw * x + qy * z - qz * y;
		var iy = qw * y + qz * x - qx * z;
		var iz = qw * z + qx * y - qy * x;
		var iw = -qx * x - qy * y - qz * z;
		this.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
		this.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
		this.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
		return this;
	  };
	  toString() {
		return "{" + Math.floor(this.x*1000)/1000 + ", " + Math.floor(this.y*1000)/1000 + ", " + Math.floor(this.z*1000)/1000 + "}";
	  };
	  hash() {
		return 1 * this.x + 12 * this.y + 123 * this.z;
	  };
}

//module.exports = Octree;
//export { Octree, Cell, Vec3 };
