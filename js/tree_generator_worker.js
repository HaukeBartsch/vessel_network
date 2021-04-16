

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

waitForTHREEJS(function(success) {
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


function createTree(label, tree2) {
	var resolutionLimit = 0.0001;

	var octree = new Octree( {x: 0, y: 0, z: 0}, 10, 1);
	// if we have a tree2 add that to the Octree now
	if (typeof(tree2) !== 'undefined') {
		// todo
	}

	var maxChildren = 2;
	var tree = { edges: [], vertices: [] };
	var bbox = [-3, -3, -3, 3, 3, 3]; // xmin, ymin, xmax, ymax
	var root = new THREE.Vector3();
	root.set(bbox[0] + (bbox[3] - bbox[0]) / 2.0,
		bbox[1] + (bbox[4] - bbox[1]) / 2.0,
		bbox[2] + (bbox[5] - bbox[2]) / 2.0); // middle of everything
	var startDiameter = 0.2;
	var factorSmallerByBranch = 0.9; // both smaller diameter and short distance
	var L = 1.0; // initial length
	var reversalPoint = 0.01; // if the diameter is smaller than that, grow again

	// lets setup a cross in 3D as the root nodes of this tree
	var dirs = [
		[0,0,0],
		[L,0,0],
		[-L,0,0],
		[0,L,0],
		[0,-L,0],
		[0,0,L],
		[0,0,-L]
	];
	tree.vertices.push({ point: root, diameter: startDiameter, side: label, direction: [0, 0, 0], factor: L, children: maxChildren, distance: 0, level: 0 });
	for (var i = 0; i < dirs.length; i++) {
		var root2 = (new THREE.Vector3()).set(root.x + dirs[i][0], root.y + dirs[i][1], root.z + dirs[i][2]);
		tree.vertices.push({ point: root2, diameter: startDiameter, side: label, direction: dirs[i], factor: L, children: 0, distance: L, level: 1 });
		tree.edges.push([0, i+1]);
		octree.add(new Vec3(root2.x, root2.y, root2.z), i+1);
	}

	// add more complexity
	// look for a random point
	var numEntries = 20000;
	for (var counter = 0; counter < numEntries; counter++) {
		if ((counter % 200) == 0) {
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
				if (tree.vertices[i].children < 2) {
					pickedNode = i;
					break;
				}
			}

			var p = tree.vertices[pickedNode];
			if (p.children > 2) {
				if (++searchIterations > 100) {
					console.log("could not find any vertex with less than 2 nodes...");
					break;
				}
				continue; // we want at most 2 children
			}
			var factor = p.factor * factorSmallerByBranch;
			if (factor < resolutionLimit)
				factor = resolutionLimit;
			var diam = p.diameter * factor;
			if (diam < resolutionLimit) {
				diam = resolutionLimit;
			}
			var dir = new THREE.Vector3(tree.vertices[pickedNode].direction[0], tree.vertices[pickedNode].direction[1], tree.vertices[pickedNode].direction[2]);
			dir = dir.normalize();
			var pp = p.point.clone().add(dir.multiplyScalar(factor * 0.5)); // momentum term
			pp = pp.add(new THREE.Vector3((Math.random() - .5) * factor, (Math.random() - 0.5) * factor, (Math.random() - 0.5) * factor));

			var candidate = {
				point: pp,
				diameter: diam,
				side: label,
				distance: p.distance + p.point.distanceTo(pp),
				level: p.level + 1,
				children: 0, // count up how many children
				direction: [], factor: factor
			};
			candidate.direction = candidate.point.clone().sub(p.point);

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
			if (!testOverlap(tree, candidate)) {
				if (typeof tree2 != 'undefined') { // in this case don't intersect with the second tree
					if (testOverlap(tree2, candidate)) {
						if (++searchIterations > 100) {
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
				octree.add(new Vec3(candidate.point.x, candidate.point.y, candidate.point.z), tree.vertices.length - 1);

				//octree.add(candidate.point);
				/*if ((tree.vertices.length % 200) == 0) {
					var id = document.getElementById("info");
					id.innerText = tree.vertices.length;
				} */
				break;
			}
			if (++searchIterations > 100) {
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
