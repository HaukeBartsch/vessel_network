# vessel_network

This small module creates and visualizes tree structures with a given diameter at each vertex. The tree is created by adding new nodes successively in a random way. Each time a node is added the module checks if the new point would overlap with the existing tree.

The process is repeated with a second tree starting at the same location. The two trees are not connected - but the module guarantees that the second tree does not overlap (other than the root nodes) with the first tree.

![Tree visualization](images/screenshot.png)

The above visualization is generated using two different colormaps for the two trees. Both colormaps use the diameter (log) as the mapped color value per vertex. The "Download" button will create two spreadsheets that contain the nodes and vertices of both trees.

The exported value "length" corresponds to the distance of the next node from the root of the tree.