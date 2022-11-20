---
title: 3D position estimation of hands
showcasetitle: 3D hand position estimation from a single RGB image
layout: showcase
---
This is a project I made when I was an undergraduate. It's based on image processing algorithms like skin color filtering, erosion and dilation, connected component analysis and finding largest incircle. The depth is evaluated by pinhole camera model. It can get a physical depth if camera correlation is done and intrisic matrix is known.


<center><video src="/assets/videos/hand3dpose.mp4" controls></video></center>


This video shows how estimated position (indicated by sphere) follows hand and the red circle is the found largest incircle.


<center><video src="/assets/videos/hand3dpose_int.mp4" controls></video></center>


This video shows an example application of this algorithm, it can be used for direct hand interaction with VR objects.

This project can further be improved with hand pose estimation algorithms, which could be another research problem.

The VR enviroment used here is Google Cardboard.