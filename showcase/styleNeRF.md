---
title: Style Transferred Neural Radiance Field
showcasetitle: Style Transferred Neural Radiance Field
layout: showcase
---

## It's a combination of style transfer and neural radiance field.

We have CNNs like VGG that can be used for image style transfer. However, they don't produce view-consistent results since it doesn't have any constraint for that. Here, view-consistency means the material color for a point of object won't suddenly change with respect to the change of view.

Neural Radiance Field (NeRF), however, learns a neural radiance field representation from images from different view points. The architecture tends to learn a continuous radiance field thus the result is view-consistent.

![Process of style transfer NeRF](/assets/images/styleNeRFArchi.PNG)

Combining them together gives a view-consistent style transferred result. The disadvantage is that, because the input is not view-consistent, the learned radiance field is just an average of inconsistent parts. And this blurs result.

<center><video class="embed-responsive" src="/assets/videos/styleNERF.mp4" controls></video></center>

In this project, an variant of NeRF called Neural Sparse Voxel Fields is used instead of the original NeRF.

[1]Liu, Lingjie, et al. "Neural sparse voxel fields." Advances in Neural Information Processing Systems 33 (2020): 15651-15663.

[2]Gatys, Leon A., Alexander S. Ecker, and Matthias Bethge. "A neural algorithm of artistic style." arXiv preprint arXiv:1508.06576 (2015).