"""Final verified adjustments; execute after finish_interiors.py."""
import bpy
from mathutils import Vector
ns=bpy.app.driver_namespace['cleanup_ns'];S=bpy.context.scene
bounds,preserve=ns['bounds'],ns['preserve']
for o in list(S.objects):
    if not o.name.startswith(('M03_Chimney','M03_WindVane')):continue
    lo,hi=bounds(o)
    if (lo.x+hi.x)/2>=0:continue
    old=bpy.data.objects.get('M06_Original_'+o.name)
    if old:
        a,b=bounds(old);dx=(lo.x+hi.x-a.x-b.x)/2
    else:dx=0
    if abs(dx+.9)>.001:preserve(o);o.location.x+=-.9-dx
for o in S.objects:
    if o.name.startswith(('M05_Elevator_Landing_','M06_Lift_BoardingBridge_')):o.location.z+=.006
    if o.name.startswith('M06_Lift_BoardingBridge_'):
        for v in o.data.vertices:
            if v.co.y>-1.125:v.co.y=-1.125
        o.data.update()
for i,z in enumerate(S.objects['M05_Elevator_Controller']['stop_floor_z']):
    ns['ring_slab'](f'M06_Lift_FloorCollar_{i:02d}',float(z)+.007,(1.94,1.94),(1.81,1.81),.032,bpy.data.materials['M05_Elevator_Frame'])
roof=S.objects['M01_Reuse_CURVE_BellGable_SlateRoof'];preserve(roof)
cut=ns['box']('M06_Lift_RoofClearance_Cutter',(0,0,25.2),(3.82,3.82,7.0),None)
cut.display_type='WIRE';cut.hide_render=True;cut.hide_set(True)
mod=roof.modifiers.new('M06_Continuous_Lift_Clearance','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cut;mod.use_hole_tolerant=True
bpy.context.view_layer.update()
