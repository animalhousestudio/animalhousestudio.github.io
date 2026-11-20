import bpy
from pathlib import Path
import os
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
frames=sorted(Path(os.environ['ARRIVAL_FRAMES']).glob('*.jpg'))
assert len(frames)==450
render=scene.render
render.fps=30
render.resolution_x,render.resolution_y,render.resolution_percentage=864,520,100
scene.view_settings.view_transform='Standard'
editor=scene.sequence_editor_create()
seq=editor.strips.new_image('Volo',str(frames[0]),channel=1,frame_start=1)
for frame in frames[1:]: seq.elements.append(frame.name)
scene.frame_end=len(frames)
audio=editor.strips.new_sound('03.112',str(Path('casa3d/audio/animale-artificiale/03.112.mp3').resolve()),channel=2,frame_start=1)

render.image_settings.media_type='VIDEO'
render.image_settings.file_format='FFMPEG'
render.ffmpeg.format='MPEG4'
render.ffmpeg.codec='H264'
render.ffmpeg.constant_rate_factor='HIGH'
render.ffmpeg.audio_codec='AAC'
render.ffmpeg.audio_bitrate=160
render.filepath=str(Path('casa3d/art/arrivo-vortice-v02/atterraggio.mp4').resolve())
bpy.ops.render.render(animation=True)
