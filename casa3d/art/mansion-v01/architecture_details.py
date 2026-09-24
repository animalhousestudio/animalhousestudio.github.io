# Executed with the generator's shared helpers/materials/collections.
# Small architectural accents, kept separate from furniture and gameplay.
for j in range(8):
    t=j*math.tau/8
    center=Vector((ocx+4.98*math.cos(t),ocy+4.22*math.sin(t),28.10))
    tangent=Vector((-4.98*math.sin(t),4.22*math.cos(t),0)).normalized()
    normal=Vector((math.cos(t)/4.98,math.sin(t)/4.22,0)).normalized()
    center+=normal*.055
    pts=[center+tangent*(.44*math.cos(k*math.tau/32))+Vector((0,0,.44*math.sin(k*math.tau/32))) for k in range(33)]
    line('Observatory_PortholeRim',pts,.065,gold,observatory)
    mesh_obj('Observatory_PortholeGlass',[center+normal*.006]+pts[:-1],[(0,k+1,(k+1)%32+1) for k in range(32)],glass,observatory)
    line('Observatory_PortholeBar',[center+Vector((0,0,-.4)),center+Vector((0,0,.4))],.018,bronze,observatory)

# Modest rear chimney and twin pots, offset from the observatory.
box('Chimney_Stack',(5.8,3.8,24.75),(1.15,1.3,4.0),plaster,retained)
for z in [23.3,24.1,24.9,25.7,26.7]:
    box('Chimney_Course',(5.8,3.8,z),(1.24,1.4,.12),oak,retained)
for y in [3.48,4.1]:
    lathe('Chimney_Pot',5.8,y,[(.24,26.75),(.22,27.65),(.29,27.7),(.29,27.83)],plaster,retained,12)

# Roof dormer on the outer face of the lower east wing.
bay('EastWing_Dormer',(14.1,2.5,14.9),2.65,2.7,(1.55,2.2),.20,sage,tower,math.pi/2)
mesh_obj('EastWing_DormerCap',[(14.38,1.0,17.5),(14.38,4.0,17.5),(14.38,2.5,19),(11.95,1,17.5),(11.95,4,17.5),(11.95,2.5,19)],[(0,3,5,2),(2,5,4,1)],slate,tower)
mesh_obj('EastWing_DormerGable',[(14.1,1.15,17.55),(14.1,3.85,17.55),(14.1,2.5,18.85)],[(0,1,2)],sage,tower)
line('EastWing_DormerBarge',[(14.4,1,17.5),(14.4,2.5,19),(14.4,4,17.5)],.075,oak,tower)
