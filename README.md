# vessel_network

This small module creates and visualizes tree structures with a given diameter at each vertex. The tree is created by adding new nodes successively in a random way. Each time a node is added the module checks if the new point would overlap with the existing tree.

The process is repeated with a second tree starting at the same location. The two trees are not connected - but the second tree will not overlap (other than the root node) with the first tree.

