

// if we want to load OpenCV.js in this worker we need to wait for Module to fill up, after the promise...
var Module = {
	onRuntimeInitialized() {
		// this is our application:
		if (typeof cv === "object")
			console.log("SOMETHING");
	}
};
self.importScripts("/js/three.js", "/js/Octree.js");

if (typeof THREE === "function") {
	const promise = THREE().then(function () {
		console.log("THREE loaded");
		THREE = Module; // this looks broken, but I don't know how to fulfill the promise any other way
	}, function () {
		console.log("Loading failed...");
	});
}

waitForTHREEJS(function (success) {
	if (success) {
		postMessage({
			"action": "READY",
			"text": "done loading THREEJS"
		});
	} else {
		console.log("perceived error loading opencv");
		//throw new Error('Error on loading OpenCV');
	}
});


onmessage = function (e) {
	//console.log("Message received in tree_generator_worker. " + JSON.stringify(e.data));
	if (typeof (e.data["label"]) == 'undefined') {
		console.log("not enough data found label and tree have to be defined");
		return;
	}

	var label = e.data["label"];
	var tree2 = e.data["tree2"];

	//var resolutionLimit = 0.0001;

	console.log("in webworker, start creating tree");
	var tree = createTree(label, tree2);
	console.log("in webworker, finished with creating tree");

	postMessage({
		"action": "message",
		"text": "done tree generation (in parseData of the webworker)!",
		"label": label,
		"result": tree
	});

	return;
}

function absolute(p) {
	p.x = Math.abs(p.x);
	p.y = Math.abs(p.y);
	p.z = Math.abs(p.z);
	return p;
}

function det(a) {
	// is array of Vector3 with .x, .y, .z
	return (a[0].x * a[1].y * a[2].z) 
		- (a[0].x * a[2].y * a[1].z) 
		- (a[1].x * a[0].y * a[2].z) 
		+ (a[1].x * a[2].y * a[0].z) 
		+ (a[2].x * a[0].y * a[1].z) 
		- (a[2].x * a[1].y * a[0].z);
}

// Given two lines defined by numpy.array pairs (a0,a1,b0,b1)
//	Return the closest points on each segment and their distance
function shortDistance(line1, line2, clampAll = false, clampA0 = false, clampA1 = false, clampB0 = false, clampB1 = false) {
	var a0 = line1.start.clone();
	var a1 = line1.end.clone();
	var b0 = line2.start.clone();
	var b1 = line2.end.clone();

	// If clampAll=True, set all clamps to True
	if (clampAll) {
		clampA0=true
		clampA1=true
		clampB0=true
		clampB1=true
	}
		
	// Calculate denomitator
	var A = a1.clone().sub(a0)
	var B = b1.clone().sub(b0)
	var magA = A.length()
	var magB = B.length()
		
	var _A = A.clone().divideScalar( magA )
	var _B = B.clone().divideScalar( magB )
		
	var cross = _A.clone().cross(_B);
	var denom = cross.length()*cross.length(); // np.linalg.norm(cross)**2
		
		
	// If lines are parallel (denom=0) test if lines overlap.
	// If they don't overlap then there is a closest point solution.
	// If they do overlap, there are infinite closest positions, but there is a closest distance
		if (denom == 0) {
			var d0 = _A.clone().dot(b0.clone().sub(a0));   // np.dot(_A,(b0-a0))
			
			// Overlap only possible with clamping
			if (clampA0 || clampA1 || clampB0 || clampB1) {
				var d1 = _A.clone().dot(b1.clone().sub(a0));  // np.dot(_A,(b1-a0))
				
				// Is segment B before A?
				if (d0 <= 0 && d0 >= d1) {
					if (clampA0 && clampB1) {
						if (absolute(d0) < absolute(d1)) {
							return [ a0, b0, a0.clone().sub(b0).length() ]
						}
						return [ a0,b1, a0.clone().sub(b1).length() ]
					}
				}					
				// Is segment B after A?
				else if (d0 >= magA && d0 <= d1) {
					if (clampA1 && clampB0) {
						if (absolute(d0) < absolute(d1)) {
							return [ a1,b0, a1.clone().sub(b0).length() ]
						}
						return [ a1,b1, a1.clone().sub(b1).length() ]
					}
				}
			}		
			// Segments overlap, return distance between parallel segments
			return [ None,None, _A.clone().multiplyScalar(d0).add(a0).sub(b0).length() ]//  np.linalg.norm(((d0*_A)+a0)-b0)
		}			
		
		
		// Lines criss-cross: Calculate the projected closest points
		var t = b0.clone().sub(a0);
		var detA = det([t, _B, cross])
		var detB = det([t, _A, cross])
	
		var t0 = detA/denom;
		var t1 = detB/denom;
	
		var pA = a0.clone().add(_A.clone().multiplyScalar(t0)); // Projected closest point on segment A
		var pB = b0.clone().add(_B.clone().multiplyScalar(t1)); // Projected closest point on segment B
	
		// Clamp projections
		if (clampA0 || clampA1 || clampB0 || clampB1) {
			if (clampA0 && (t0 < 0)) {
				pA = a0
			} else if (clampA1 && (t0 > magA)) {
				pA = a1
			}
			
			if (clampB0 && (t1 < 0)) {
				pB = b0
			} else if (clampB1 && (t1 > magB)) {
				pB = b1
			}
				
			// Clamp projection A
			if ( (clampA0 && (t0 < 0)) || (clampA1 && (t0 > magA)) ) {
				var dot = _B.clone().dot((pA.clone().sub(b0)))
				if (clampB0 && (dot < 0)) {
					dot = 0
				} else if (clampB1 && (dot > magB)) {
					dot = magB
				}
				pB = b0.clone().add((_B.clone().multiplyScalar(dot)))
			}		
			// Clamp projection B
			if ( (clampB0 && (t1 < 0)) || (clampB1 && (t1 > magB)) ) {
				var dot = _A.clone().dot((pB.clone().sub(a0)))
				if (clampA0 && (dot < 0)) {
					dot = 0
				} else if (clampA1 && (dot > magA)) {
					dot = magA
				}
				pA = a0.clone().add(_A.clone().multiplyScalar(dot))
			}	
		}
		return [ pA,pB, pA.clone().sub(pB).length() ] // np.linalg.norm(pA-pB)
}


function createTree(label, tree2) {
	var resolutionLimit = 0.0008/2.0; // radius

	// our model unit is in meter but we can redefine them to mean
	// 2.5 ... 0.0008 
	// thhe units below are micrometer, 25,000 microns == 25mm
	var thickLabel = [
		["A", "aorta", 25000, 2000],
		["A", "artery", 4000, 1000],
		["A", "arteriole", 30, 20],
		["C", "capillary", 8, 1],
		["B", "venule", 20, 2],
		["B", "vein", 5000, 500],
		["B", "vena cava", 25000, 1500]
	];

	var octree = undefined; // new Octree( {x: 0, y: 0, z: 0}, 10, 1);
	// if we have a tree2 add that to the Octree now
	if (typeof (tree2) !== 'undefined') {
		// todo
		if (typeof (octree) != 'undefined') {
			for (var i = 0; i < tree2.vertices.length; i++) {
				octree.add(new Vec3(tree2.vertices[i].point.x, tree2.vertices[i].point.y, tree2.vertices[i].point.z),
					{ id: i, label: tree2.vertices[i].label });
			}
		}
	}

	var maxChildren = 2;
	// AORTA
	var startDiameter = 2.5/2.0; // what we call diameter is actually the radius
	// ARTERY
	startDiameter = 0.4/2.0;

	var L = startDiameter * 10.0; // initial length
	var tree = { edges: [], vertices: [] };
	var bbox = [-300, -300, -300, 300, 300, 300]; // xmin, ymin, xmax, ymax
	var root = new THREE.Vector3();
	root.set(bbox[0] + (bbox[3] - bbox[0]) / 2.0,
		bbox[1] + (bbox[4] - bbox[1]) / 2.0,
		bbox[2] + (bbox[5] - bbox[2]) / 2.0); // middle of everything
	// if we want to get a smaller diameter vessel with the same area (volume) as the
	// larger vessel we should divide the radius by 4 1/4 = 0.25
	var factorSmallerByBranch = 0.25; // both smaller diameter and short distance
	factorSmallerByBranch = 0.99;

	// how many levels do we need to reach rock bottom?
	// roughly 40 levels down (0.8 smaller and starting with 1.15 as diameter)

	// lets setup a cross in 3D as the root nodes of this tree
	var dirs = [
		[L, 0, 0],
		[-L, 0, 0],
		[0, L, 0],
		[0, -L, 0],
		[0, 0, L],
		[0, 0, -L]
	];
	tree.vertices.push({ point: root, diameter: startDiameter, side: label, direction: [0, 0, 0], factor: 1, children: dirs.length, distance: 0, level: 0 });
	for (var i = 0; i < dirs.length; i++) {
		var root2 = (new THREE.Vector3()).set(root.x + dirs[i][0], root.y + dirs[i][1], root.z + dirs[i][2]);
		tree.vertices.push({ point: root2, diameter: startDiameter, side: label, direction: dirs[i], factor: 1, children: 0, distance: L, level: 1 });
		tree.edges.push([0, i + 1]);
		if (typeof (octree) != 'undefined')
			octree.add(new Vec3(root2.x, root2.y, root2.z), { id: i + 1, tree: label });
	}

	// add more complexity
	// look for a random point
	var numEntries = 8000;
	var attempts = 20;
	for (var counter = 0; counter < numEntries; counter++) {
		if ((counter % 10) == 0) {
			postMessage({
				"action": "info",
				"text": "Create entry " + (tree.vertices.length) + "/" + (numEntries),
				"label": label
			});
		}
		var searchIterations = 0;
		while (true) {
			var pickedNode = Math.floor(Math.random() * tree.vertices.length);
			// instead of random picking lets do a breath first search
			for (var i = 0; i < tree.vertices.length; i++) {
				if (tree.vertices[i].children < maxChildren && (typeof(tree.vertices[i].attempt) !== 'undefined' && tree.vertices[i].attempt < attempts)) {
					pickedNode = i;
					break;
				}
			}
			if (typeof (tree.vertices[pickedNode].attempt) == 'undefined')
				tree.vertices[pickedNode].attempt = 0;
			tree.vertices[pickedNode].attempt++;

			var p = tree.vertices[pickedNode];
			if (p.children >= maxChildren) {
				if (++searchIterations > attempts) {
					console.log("could not find any vertex with less than 2 nodes...");
					break;
				}
				continue; // we want at most 2 children
			}
			var factor = p.factor * factorSmallerByBranch;
			if (factor < resolutionLimit)
				factor = resolutionLimit;
			var diam = p.diameter * factorSmallerByBranch;
			if (diam < resolutionLimit) {
				diam = resolutionLimit;
			}
			var dir = new THREE.Vector3(tree.vertices[pickedNode].direction[0], tree.vertices[pickedNode].direction[1], tree.vertices[pickedNode].direction[2]);
			var l = dir.length();
			dir = dir.normalize();
			var pp = dir.multiplyScalar(factor * l * 0.4); // momentum term, the smaller the less directed
			pp = pp.add(new THREE.Vector3((Math.random() - 0.5) * l * factor, 
					                      (Math.random() - 0.5) * l * factor, 
										  (Math.random() - 0.5) * l * factor));
			// make the new position depend on the diameter
			pp = p.point.clone().add(pp.normalize().multiplyScalar(diam*20));

			var candidate = {
				point: pp,
				diameter: diam,
				side: label,
				distance: p.distance + p.point.distanceTo(pp),
				level: p.level + 1,
				children: 0, // count up how many children
				direction: [], 
				factor: factor
			};
			cd = candidate.point.clone().sub(p.point);
			candidate.direction = [ cd.x, cd.y, cd.z ];

			// test if the candidate overlaps with existing tree (true, otherwise false)
			function testOverlap(tree, candidate) {
				var point = candidate.point;
				// return boolean to see if candidate overlaps with the existing tree
				var line = new THREE.Line3();
				for (var i = 0; i < tree.edges.length; i++) { // check for all line segments in the tree
					var edge = tree.edges[i];
					var C = new THREE.Vector3();
					line.set(tree.vertices[edge[0]].point, tree.vertices[edge[1]].point).closestPointToPoint(point, true, C);
					var distance = point.distanceTo(C);
					// we want to be farther away than the diameters of both
					var threshold = tree.vertices[edge[1]].diameter + candidate.diameter;
					if (distance < threshold)
						return true; // too close
				}
				return false;
			}
			function testOverlap2(tree, p, candidate) {
				// test if the line segment p - candidate intersects any other line segment given its thickness
				var line1 = new THREE.Line3();
				var line2 = new THREE.Line3();
				line1.set(p.point, candidate.point);
				var thick1 = candidate.diameter / 2.0;
				for (var i = 0; i < tree.edges.length; i++) {
					line2.set( tree.vertices[tree.edges[i][0]].point, tree.vertices[tree.edges[i][1]].point );
					var d = shortDistance(line1, line2, clampAll = true); // use clampAll
					var thick2 = tree.vertices[tree.edges[i][1]].diameter / 2.0;
					var threshold = thick2 + (candidate.diameter / 2.0);
					if ( (d[2] > 0) && (d[2] < threshold)) { // we want to ignore if the points are the same
						return true;
					}
				}
				return false;
			}
			function testOverlapOctree(tree, candidate, octree) {
				var point = candidate.point;
				// return boolean to see if candidate overlaps with the existing tree
				var line = new THREE.Line3();
				var closest = octree.findNearbyPoints(new Vec3(point.x, point.y, point.z), 1, { notSelf: false, includeData: true });
				// we have now closest.data and closest.points, in data we have id: 1 and tree: 'A'
				for (var i = 0; i < closest.length; i++) { // check for all line segments in the tree
					for (var j = 0; j < tree.edges.length; j++) {
						if (tree.edges[j][0] != closest[i].data.id && tree.edges[j][1] != closest[i].data.id)
							continue;

						var edge = tree.edges[j];
						var C = new THREE.Vector3();
						line.set(tree.vertices[edge[0]].point, tree.vertices[edge[1]].point).closestPointToPoint(point, true, C);
						var distance = point.distanceTo(C);
						// we want to be farther away than the diameters of both
						var threshold = tree.vertices[edge[1]].diameter + candidate.diameter;
						if (distance < threshold)
							return true; // too close
					}
				}
				return false;
			}

			if (!testOverlap2(tree, p, candidate)) {
				if (typeof tree2 != 'undefined') { // in this case don't intersect with the second tree
					if (testOverlap2(tree2, p, candidate)) {
						if (++searchIterations > attempts) {
							//console.log("too many search iterations, no more nodes found");
							break; // without adding a node
						}
						continue; // adhere to the second tree, don't interfere with it
					}
				}
				// append this candidate to the tree
				tree.vertices[pickedNode].children++;
				tree.vertices.push(candidate);
				tree.edges.push([pickedNode, tree.vertices.length - 1]);
				if (typeof (octree) != 'undefined')
					octree.add(new Vec3(candidate.point.x, candidate.point.y, candidate.point.z), { id: tree.vertices.length - 1, tree: label });
				break;
			}
			if (++searchIterations > attempts) {
				console.log("too many search iterations, no more nodes found");
				break; // without adding a node
			}
		}
	}
	return tree;
}

function waitForTHREEJS(callbackFn, waitTimeMs = 60000, stepTimeMs = 100) {
	if (THREE.Vector3) callbackFn(true)

	let timeSpentMs = 0
	const interval = setInterval(() => {
		const limitReached = timeSpentMs > waitTimeMs
		if (THREE.Vector3 || limitReached) {
			clearInterval(interval)
			return callbackFn(!limitReached)
		} else {
			timeSpentMs += stepTimeMs
		}
	}, stepTimeMs)
}
