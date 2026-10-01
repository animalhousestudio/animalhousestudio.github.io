"""Near-black bear head in nominal player coordinates (Z up, front -Y).

Call ``build_head(globals())`` from the character builder. All geometry is
created through its weighted helpers, in its HEAD collection. This module does
not reset a scene, change cameras, save, render, or export.
"""


def build_head(ns):
    ellipsoid = ns['ellipsoid']
    loft = ns['loft']
    seam = ns['seam']
    material = ns['material']
    head_collection = ns['HEAD']
    fur = ns['fur']

    muzzle = material('Bear | short charcoal muzzle', (.014, .0145, .016), .82)
    inner_ear = material('Bear | velvet inner ear', (.020, .019, .021), .9)
    nose = material('Bear | black nose and mouth', (.0025, .0023, .0025), .29)
    iris = material('Bear | dark warm eyes', (.026, .014, .007), .22)
    pupil = material('Bear | deep pupil', (.0012, .0011, .0010), .2)
    eye_glint = material('Bear | tiny eye catchlight', (.68, .67, .59), .18)
    objects = []

    # A substantial fur neck meets the broad jaw, without a human throat shape.
    objects.append(loft('Bear_Neck', [
        (1.445, 0, .031, .084, .072, {'neck': 1}),
        (1.488, 0, .028, .088, .075, {'neck': 1}),
        (1.548, 0, .026, .086, .073, {'neck': .60, 'head': .40}),
        (1.598, 0, .023, .085, .074, {'neck': .15, 'head': .85}),
        (1.619, 0, .021, .081, .071, {'head': 1}),
    ], fur, head_collection, n=20, level=1))

    objects.append(ellipsoid('Bear_Skull', (0, .005, 1.670),
                             (.130, .110, .145), fur, head_collection,
                             'head', segments=28, rings=18))
    objects.append(ellipsoid('Bear_Lower_Jaw', (0, -.038, 1.575),
                             (.104, .084, .055), fur, head_collection,
                             'head', segments=24, rings=12))

    # Rounded cheek masses soften the junction to the short, broad snout.
    for side, sign in [('L', 1), ('R', -1)]:
        objects.append(ellipsoid('Bear_Cheek.' + side,
                                 (sign * .077, -.044, 1.618),
                                 (.060, .067, .070), fur, head_collection,
                                 'head', segments=20, rings=12))

        # Short, round ears overlap the skull at the inner base. The dark inner
        # cup faces forward; no separate human ear or eyebrow geometry remains.
        objects.append(ellipsoid('Bear_Round_Ear.' + side,
                                 (sign * .123, .005, 1.780),
                                 (.043, .028, .045), fur, head_collection,
                                 'head', segments=20, rings=12))
        objects.append(ellipsoid('Bear_Inner_Ear.' + side,
                                 (sign * .125, -.0195, 1.784),
                                 (.027, .0065, .029), inner_ear, head_collection,
                                 'head', segments=16, rings=10))

    objects.append(ellipsoid('Bear_Broad_Short_Muzzle', (0, -.135, 1.612),
                             (.076, .072, .057), muzzle, head_collection,
                             'head', segments=28, rings=14))

    # Inverted rounded triangular nose: broad across its top, gently narrower
    # below. Its foremost point sits at approximately Y=-.225 before scaling.
    objects.append(loft('Bear_Nose', [
        (1.621, 0, -.198, .010, .007, {'head': 1}),
        (1.627, 0, -.200, .025, .018, {'head': 1}),
        (1.642, 0, -.201, .038, .025, {'head': 1}),
        (1.657, 0, -.200, .041, .025, {'head': 1}),
        (1.665, 0, -.198, .032, .019, {'head': 1}),
    ], nose, head_collection, n=20, level=1))

    for side, sign in [('L', 1), ('R', -1)]:
        objects.append(ellipsoid('Bear_Nostril.' + side,
                                 (sign * .019, -.2226, 1.646),
                                 (.0073, .0020, .0034), pupil, head_collection,
                                 'head', segments=12, rings=8))

        # Warm near-black eyes and very small highlights; no white sclera.
        objects.append(ellipsoid('Bear_Eye.' + side,
                                 (sign * .060, -.098, 1.691),
                                 (.0118, .0070, .0114), iris, head_collection,
                                 'head', segments=16, rings=10))
        objects.append(ellipsoid('Bear_Pupil.' + side,
                                 (sign * .060, -.1041, 1.691),
                                 (.0060, .0015, .0070), pupil, head_collection,
                                 'head', segments=12, rings=8))
        objects.append(ellipsoid('Bear_Eye_Glint.' + side,
                                 (sign * .060 - .0026, -.10565, 1.6945),
                                 (.00155, .00070, .00155), eye_glint, head_collection,
                                 'head', segments=10, rings=6))

    # A restrained muzzle split and shallow mouth keep a gentle neutral face.
    objects.append(seam('Bear_Muzzle_Split', [
        (0, -.2057, 1.625), (0, -.2076, 1.613), (0, -.2065, 1.602),
    ], .0013, nose, head_collection, 'head'))
    objects.append(seam('Bear_Mouth', [
        (-.037, -.1960, 1.599), (-.018, -.2022, 1.595),
        (0, -.2054, 1.598), (.018, -.2022, 1.595), (.037, -.1960, 1.599),
    ], .00125, nose, head_collection, 'head'))

    for obj in objects:
        obj['authoring_role'] = 'bear_head_separate_for_first_person'
    return {
        'objects': objects,
        'metadata': {
            'style': 'near-black bear, broad short muzzle, round ears',
            'front_axis': '-Y',
            'nominal_head_top_m': 1.825,
            'nominal_eye_centres': [[-.060, -.098, 1.691], [.060, -.098, 1.691]],
            'mesh_only': True,
            'head_hide_supported': True,
        },
    }
