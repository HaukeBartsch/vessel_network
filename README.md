# Network of tubular structures

This module creates and visualizes tree structures with a given diameter at each vertex. The tree is created by adding new nodes successively in a random way. Each time a node is added the module checks if the new point would overlap with the existing tree. The overlap is specified by the diameter of both vessel structures.

The process is repeated with a second tree starting at the same location. The two trees are not connected - but the module guarantees that the second tree does not overlap (other than the root nodes at 0,0,0) with the first tree.

![Tree visualization](images/screenshot.png)

The above visualization is generated using two different colormaps for the two trees ('A' and 'B'). Both colormaps use the diameter (log) as the mapped color value per vertex. The "Download" button will create two spreadsheets that contain the nodes and vertices of both trees.

The exported value "length" corresponds to the distance of the next node from the root of the tree, the "level" value corresponds to the number of branching points previously.

### How to start

The module is written in JavaScript. Download (git clone) the repository and start a webserver in the directory. Here an example with the  build-in  web-server from php

```
php -S localhost:3000
```

Navigate to the web-address (localhost:3000). You need to wait for the tree generation to finish. As there are no Octree magics going on this will take a while. Adjust the number of vertices in the code (index.html, see loop counter in line 74).

### Remarks

The first tree 'A' is created first. The second tree 'B' will be grown afterwards. It would be better to grow both trees at the same time. Right now the first tree can crowd out the space and the second tree cannot find a corner to grow from.

The nodes are added in each tree based on a breath first search manner. The number of possible segments starting from any segments end point is 2.

The diameter value starts at something like 0.2 and is reduced each depth level by a factor of 0.9. The length of the start segments is 1 and also reduced by the factor of 0.9 (with some noise).

There is a momentum term for the direction of the segment growth (and a lot of noise).

We should preferably grow segments in directions that have a low density of segments in them (octree). This would ensure that the small vessels fill the space.

The diameter of vessels should correspond to the volume of blood in the sub-tree that is downstream. Vessels that reach a large area without segments could grow in diameter.

