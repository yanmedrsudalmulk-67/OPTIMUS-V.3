"""Build an original nurse character PREVIEW ONLY, separate from the application.
Run: blender -b --factory-startup --python scripts/blender/create_nurse_preview.py
Blender 4.3+, no downloaded assets. Front is -Y, Z is up.
"""
import bpy
import math
import random
import json
from pathlib import Path
from mathutils import Vector
import numpy as np

ROOT = Path.cwd()
OUT = ROOT / 'design/previews/nurse-alya'
OUT.mkdir(parents=True, exist_ok=True)
random.seed(18)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)
bpy.context.preferences.filepaths.save_version = 0

def material(name, rgb, roughness=.7, subsurface=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    n = m.node_tree.nodes.get('Principled BSDF')
    n.inputs['Base Color'].default_value = (*rgb, 1)
    n.inputs['Roughness'].default_value = roughness
    n.inputs['Subsurface Weight'].default_value = subsurface
    return m

skin = material('Warm peach skin', (.78, .46, .29), .68, .11)
nose_mat = material('Rosy nose', (.79, .35, .245), .65, .10)
ear_mat = material('Ear soft interior', (.62, .26, .17), .8)
hair = material('Chestnut hair', (.075, .023, .007), .67)
hair_light = material('Warm hair ribbons', (.12, .045, .014), .69)
hair_dark = material('Dark hair ribbons', (.055, .015, .004), .74)
white = material('Warm eye whites', (.94, .91, .82), .34)
iris_edge = material('Iris outer brown', (.068, .025, .009), .33)
iris = material('Hazel brown irises', (.30, .115, .025), .31)
iris_inner = material('Iris amber centre', (.43, .21, .055), .34)
pupil = material('Pupils', (.008, .004, .002), .18)
shine = material('Eye highlights', (1, .98, .91), .18)
mouth_mat = material('Warm smile', (.42, .105, .064), .82)
freckle_mat = material('Freckles', (.39, .17, .075), .9)
shirt = material('White cotton tee', (.88, .87, .81), .92)
shirt_edge = material('Tee collar', (.74, .73, .67), .94)
green = material('Sage fleece', (.32, .44, .20), .97)
green_dark = material('Ribbed sage cuffs', (.245, .345, .145), .96)
zipper_mat = material('Sage zipper details', (.40, .50, .28), .89)
trouser = material('Ivory trousers', (.72, .75, .66), .93)
shoe = material('Soft canvas shoes', (.81, .78, .64), .92)
sole = material('Rubber soles', (.91, .88, .74), .95)

# A packed, original felt/knit map survives the GLB export as a base-colour texture.
size = 512
rng = np.random.default_rng(75)
yy, xx = np.mgrid[0:size, 0:size]
fibres = rng.normal(0, .025, (size, size))
knit = .022 * np.cos(xx * math.pi / 5) * np.sin(yy * math.pi / 7)
fleck = np.clip(fibres + knit, -.065, .065)
pixels = np.empty((size, size, 4), dtype=np.float32)
for c, base in enumerate((.32, .44, .20)):
    pixels[:, :, c] = np.clip(base + fleck, 0, 1)
pixels[:, :, 3] = 1
tex = bpy.data.images.new('Original packed sage fleece', width=size, height=size)
tex.pixels.foreach_set(pixels.ravel())
tex.pack()
node = green.node_tree.nodes.new('ShaderNodeTexImage')
node.image = tex
node.interpolation = 'Linear'
green.node_tree.links.new(node.outputs['Color'], green.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
noise = green.node_tree.nodes.new('ShaderNodeTexNoise')
noise.inputs['Scale'].default_value = 175
bump = green.node_tree.nodes.new('ShaderNodeBump')
bump.inputs['Strength'].default_value = .12
bump.inputs['Distance'].default_value = .012
green.node_tree.links.new(noise.outputs['Fac'], bump.inputs['Height'])
green.node_tree.links.new(bump.outputs['Normal'], green.node_tree.nodes['Principled BSDF'].inputs['Normal'])

parts, bindings, lid_rows = [], [], []
def finish(obj, name, mat, bone=None):
    obj.name = name
    if mat: obj.data.materials.append(mat)
    if obj.type == 'MESH':
        for p in obj.data.polygons: p.use_smooth = True
    parts.append(obj)
    if bone: bindings.append((obj, bone))
    return obj

def ellipsoid(name, centre, scale, mat, bone=None, segments=28, rings=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=centre)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat, bone)

def curve(name, points, radius, mat, bone=None, resolution=3, taper=False):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.resolution_u = 10
    data.bevel_depth = radius
    data.bevel_resolution = resolution
    sp = data.splines.new('BEZIER')
    sp.bezier_points.add(len(points)-1)
    for index, (p, co) in enumerate(zip(sp.bezier_points, points)):
        p.co = co
        if taper: p.radius=1-.86*index/max(1,len(points)-1)
        p.handle_left_type = p.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
    return finish(obj, name, mat, bone)

def mesh_rings(name, rings, mat, bone, sides=40, gap=0):
    verts, faces, uv = [], [], []
    for r, (z, wx, dy, cy) in enumerate(rings):
        for i in range(sides):
            a = -math.pi/2 + gap + (2*math.pi-2*gap)*i/(sides-1 if gap else sides)
            verts.append((wx*math.cos(a), cy+dy*math.sin(a), z))
            uv.append((i/(sides-1), r/(len(rings)-1)))
    for r in range(len(rings)-1):
        for i in range(sides-1 if gap else sides):
            j=(i+1)%sides
            faces.append((r*sides+i,r*sides+j,(r+1)*sides+j,(r+1)*sides+i))
    if not gap:
        faces.append(tuple(reversed(range(sides))))
        faces.append(tuple((len(rings)-1)*sides+i for i in range(sides)))
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    layer=data.uv_layers.new(name='UVMap')
    for poly in data.polygons:
        for li in poly.loop_indices:layer.data[li].uv=uv[data.loops[li].vertex_index]
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj)
    finish(obj,name,mat,bone)
    sub=obj.modifiers.new('Tailored soft silhouette','SUBSURF');sub.levels=1
    bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=sub.name)
    if gap:
        solid=obj.modifiers.new('Fleece thickness','SOLIDIFY');solid.thickness=.025
        bpy.ops.object.modifier_apply(modifier=solid.name)
    return obj

def sleeve(name, points, radii, bone):
    points=[Vector(p) for p in points]
    verts, faces, uv=[],[],[]
    count, sides=23,24
    for r in range(count):
        t=r/(count-1);segment=0 if t<=.5 else 1;u=t*2 if segment==0 else (t-.5)*2
        control=2*points[1]-.5*(points[0]+points[2])
        centre=(1-t)**2*points[0]+2*(1-t)*t*control+t*t*points[2]
        direction=(2*(1-t)*(control-points[0])+2*t*(points[2]-control)).normalized()
        right=Vector((0,1,0)).cross(direction).normalized();front=direction.cross(right).normalized()
        radius=radii[segment]*(1-u)+radii[segment+1]*u
        radius*=1+.022*math.sin(t*9*math.pi)
        for i in range(sides):
            a=i/sides*2*math.pi
            verts.append(centre+radius*(right*math.cos(a)+front*math.sin(a)))
            uv.append((i/sides,t))
        if r:
            for i in range(sides):
                j=(i+1)%sides;faces.append(((r-1)*sides+i,(r-1)*sides+j,r*sides+j,r*sides+i))
    faces.append(tuple(reversed(range(sides))));faces.append(tuple((count-1)*sides+i for i in range(sides)))
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    layer=data.uv_layers.new(name='UVMap')
    for poly in data.polygons:
        for li in poly.loop_indices:layer.data[li].uv=uv[data.loops[li].vertex_index]
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);finish(obj,name,green,bone)
    sub=obj.modifiers.new('Soft crossed fleece sleeve','SUBSURF');sub.levels=1
    bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=sub.name)
    return obj

def eyelid(side, x0, upper):
    # Curved skin shields slide over fixed eyes; no eye/pupil squashing.
    rows, cols = (11 if upper else 9), 25
    # Covers clear the forward pupil highlights during closure, including
    # the small yaw in the browser preview. The eye meshes stay unchanged.
    rx, ry, rz, cy, cz = .116, .110, .140, -.287, 2.285
    meet=math.pi/2+.055
    prefix=('UpperLid.' if upper else 'LowerLid.')+side
    verts, faces=[],[]
    for row in range(rows):
        u=row/(rows-1)
        rest=.025+u*(.30-.025) if upper else (math.pi-.15)+u*(.15-.025)
        closed=.025+u*(meet-.025) if upper else meet+u*(math.pi-.025-meet)
        name=prefix+'.'+str(row).zfill(2)
        lid_rows.append({'name':name,'rest':rest,'closed':closed,'pos':(x0,cy,cz+rz*math.cos(rest)),'rz':rz})
        for i in range(cols):
            phi=-math.pi/2+i/(cols-1)*math.pi
            verts.append((x0+rx*math.sin(rest)*math.sin(phi),cy-ry*math.sin(rest)*math.cos(phi),cz+rz*math.cos(rest)))
        if row:
            for i in range(cols-1):faces.append(((row-1)*cols+i,row*cols+i,row*cols+i+1,(row-1)*cols+i+1))
    data=bpy.data.meshes.new(prefix);data.from_pydata(verts,[],faces);data.update()
    obj=bpy.data.objects.new(prefix,data);bpy.context.collection.objects.link(obj);finish(obj,prefix,skin)
    for row in range(rows):
        group=obj.vertex_groups.new(name=prefix+'.'+str(row).zfill(2));group.add(list(range(row*cols,(row+1)*cols)),1,'REPLACE')
    if upper:
        # The upper lid margin becomes a soft closed-eye line when both lids meet.
        points=[]
        for i in range(15):
            phi=-math.pi/2+i/14*math.pi
            points.append((x0+(rx+.001)*math.sin(.30)*math.sin(phi),cy-(ry+.002)*math.sin(.30)*math.cos(phi),cz+rz*math.cos(.30)))
        curve('Natural eyelid margin.'+side,points,.0018,hair_dark,prefix+'.'+str(rows-1).zfill(2),2)

# An oversized cardigan hangs over a simple tee, rather than a medical costume.
mesh_rings('White cotton t-shirt',[(.72,.26,.17,0),(.78,.30,.19,0),(1.04,.30,.19,0),(1.39,.32,.18,0),(1.53,.29,.16,0),(1.62,.14,.12,0)],shirt,'Spine')
mesh_rings('Open sage fleece cardigan',[(.69,.33,.20,.025),(.75,.37,.235,.025),(1.01,.36,.23,.025),(1.34,.38,.215,.025),(1.51,.37,.19,.025),(1.60,.20,.14,.025)],green,'Spine',gap=.40)
ellipsoid('Slender neck',(0,0,1.74),(.105,.10,.22),skin,'Neck')
curve('White crew neck',[(-.125,-.125,1.61),(-.10,-.17,1.56),(0,-.184,1.535),(.10,-.17,1.56),(.125,-.125,1.61)],.016,shirt_edge,'Spine')
curve('Folded fleece hood',[(-.20,-.105,1.60),(-.23,.055,1.72),(0,.18,1.75),(.23,.055,1.72),(.20,-.105,1.60)],.065,green,'Spine',4)
for sign in [-1,1]:
    curve('Soft cardigan opening',[(sign*.17,-.154,1.59),(sign*.18,-.20,1.43),(sign*.16,-.223,1.11),(sign*.145,-.224,.75)],.019,green_dark,'Spine',3)
    curve('Hood drawstring',[(sign*.17,-.197,1.58),(sign*.18,-.244,1.43),(sign*.19,-.25,1.31)],.006,zipper_mat,'Spine',2)
    ellipsoid('Drawstring end',(sign*.19,-.25,1.31),(.008,.009,.025),zipper_mat,'Spine',12,8)
    curve('Cardigan pocket seam',[(sign*.18,-.205,.88),(sign*.27,-.21,.91),(sign*.33,-.20,1.00)],.0045,green_dark,'Spine',2)
curve('Cardigan ribbed hem',[(-.33,-.105,.735),(-.23,-.205,.71),(-.15,-.224,.71)],.022,green_dark,'Spine')
curve('Cardigan ribbed hem',[(.33,-.105,.735),(.23,-.205,.71),(.15,-.224,.71)],.022,green_dark,'Spine')

# Readable crossed forearms, with the nearer forearm lower on the chest.
crossed = {
 'L':[(-.34,.005,1.48),(-.53,-.12,1.12),(.29,-.38,1.34)],
 'R':[(.34,.005,1.48),(.53,-.12,1.04),(-.27,-.49,1.17)],
}
for side, points in crossed.items():
    sleeve('Oversized crossed sleeve.'+side,points,[.18,.18,.105],'Spine')
    end=Vector(points[2]);direction=(end-Vector(points[1])).normalized()
    cuff=ellipsoid('Ribbed cuff.'+side,end, (.11,.11,.085),green_dark,'Spine',24,16)
    cuff.rotation_euler=direction.to_track_quat('Z','Y').to_euler()
    palm=end+direction*.065
    hand=ellipsoid('Resting hand.'+side,palm,(.073,.040,.105),skin,'Spine',24,16)
    hand.rotation_euler[1]=(-.55 if side=='L' else .6)
    # Relaxed visible fingers curve over the opposing sleeve.
    for i in range(4):
        finger=ellipsoid('Soft fingers.'+side,(palm.x+(i-1.5)*.027,palm.y-.025,palm.z-.055),(.017,.024,.06-i*.003),skin,'Spine',16,10)
        finger.rotation_euler[1]=(-.45 if side=='L' else .45)
    ellipsoid('Thumb.'+side,(palm.x+(.055 if side=='L' else -.055),palm.y-.018,palm.z+.005),(.028,.028,.05),skin,'Spine',18,12)

# Lower body is complete for inspection, though the portrait is framed at the hips.
for sign,side in [(-1,'L'),(1,'R')]:
    mesh_rings('Ivory trouser leg.'+side,[(.13,.12,.12,0),(.18,.13,.13,0),(.45,.14,.14,0),(.72,.16,.15,0),(.86,.14,.14,0)],trouser,'Hips',sides=24)
    obj=parts[-1];obj.location.x=sign*.17
    ellipsoid('Canvas shoe.'+side,(sign*.17,-.065,.12),(.15,.23,.12),shoe,'Hips')
    ellipsoid('Soft sole.'+side,(sign*.17,-.065,.045),(.155,.237,.042),sole,'Hips')

# A shaped head keeps broad cheeks and a gently tapered chin.
head=ellipsoid('Rounded expressive face',(0,0,2.22),(.405,.315,.455),skin,'Head',48,36)
for v in head.data.vertices:
    zn=v.co.z/.455
    v.co.x*=1+.065*math.exp(-((zn+.20)/.40)**2)-.15*max(0,-zn)**2
    if v.co.y<0:v.co.y*=1+.055*math.exp(-((zn+.25)/.40)**2)
for sign,side in [(-1,'L'),(1,'R')]:
    ellipsoid('Ear.'+side,(sign*.39,.005,2.22),(.074,.055,.105),skin,'Head',24,16)
    ellipsoid('Inner ear.'+side,(sign*.412,-.045,2.22),(.033,.014,.065),ear_mat,'Head',20,14)
    eye_pos=(sign*.155,-.287,2.285)
    ellipsoid('Eye white.'+side,eye_pos,(.112,.048,.133),white,'Eye.'+side,32,24)
    ellipsoid('Brown iris rim.'+side,(sign*.155,-.333,2.28),(.074,.017,.085),iris_edge,'Eye.'+side,32,24)
    ellipsoid('Warm brown iris.'+side,(sign*.155,-.348,2.28),(.064,.012,.075),iris,'Eye.'+side,32,24)
    ellipsoid('Amber iris centre.'+side,(sign*.155,-.359,2.28),(.045,.007,.054),iris_inner,'Eye.'+side,24,16)
    ellipsoid('Pupil.'+side,(sign*.155,-.367,2.28),(.035,.009,.046),pupil,'Eye.'+side,24,18)
    ellipsoid('Main catchlight.'+side,(sign*.155-.018,-.377,2.309),(.015,.004,.019),shine,'Eye.'+side,16,12)
    ellipsoid('Small catchlight.'+side,(sign*.155+.017,-.378,2.261),(.007,.003,.008),shine,'Eye.'+side,12,8)
    eyelid(side,sign*.155,True)
    eyelid(side,sign*.155,False)
    curve('Expressive brow.'+side,[(sign*.155-.098,-.286,2.467),(sign*.155,-.301,2.496),(sign*.155+.098,-.286,2.473)],.015,hair,'Head',3)
ellipsoid('Rounded rosy nose',(0,-.337,2.186),(.064,.069,.052),nose_mat,'Head',32,22)
for sign in [-1,1]:ellipsoid('Nostril',(sign*.030,-.390,2.166),(.012,.005,.008),ear_mat,'Head',14,8)
curve('Gentle smile',[(-.13,-.287,2.062),(-.065,-.316,2.027),(0,-.325,2.022),(.065,-.316,2.027),(.13,-.287,2.062)],.009,mouth_mat,'Head',3)
curve('Soft lower lip',[(-.058,-.317,2.014),(0,-.327,2.006),(.058,-.317,2.014)],.005,nose_mat,'Head',2)

# Freckles are flush tiny polygons on the cheek surface, not raised spheres.
freckle_objects=[]
for sign in [-1,1]:
    for i in range(22):
        x=sign*(.105+random.random()*.19);z=2.13+random.random()*.10
        y=-.315*math.sqrt(max(.04,1-(x/.42)**2-((z-2.22)/.455)**2))*1.04-.003
        normal=Vector((x/(.42*.42),y/(.328*.328),(z-2.22)/(.455*.455))).normalized()
        bpy.ops.mesh.primitive_circle_add(vertices=8,radius=random.uniform(.004,.0065),fill_type='NGON',location=(x,y,z))
        obj=bpy.context.object;obj.rotation_euler=normal.to_track_quat('Z','Y').to_euler()
        freckle_objects.append(finish(obj,'Tiny freckles',freckle_mat,'Head'))

# Hair is an organic connected mass with fine swept ribbons and loose wisps.
# Closed, shaped shell: unlike an open clipped sphere this survives voxelunion.
verts,faces=[],[]
cols,rows=64,18
for layer in [0,1]:
    rx,ry,rz=(.442,.366,.49) if layer==0 else (.411,.334,.462)
    for row in range(rows):
        u=(row+.02)/(rows-1+.02)
        for i in range(cols):
            phi=i/cols*math.pi*2
            limit=1.57+.59*math.sin(phi)+.035*math.cos(phi*3)
            theta=.012+u*limit
            verts.append((rx*math.sin(theta)*math.cos(phi),.017+ry*math.sin(theta)*math.sin(phi),2.23+rz*math.cos(theta)))
    offset=layer*rows*cols
    for row in range(rows-1):
        for i in range(cols):
            j=(i+1)%cols;f=(offset+row*cols+i,offset+row*cols+j,offset+(row+1)*cols+j,offset+(row+1)*cols+i)
            faces.append(tuple(reversed(f)) if layer else f)
    faces.append(tuple(offset+i for i in reversed(range(cols))))
for i in range(cols):
    j=(i+1)%cols
    faces.append(((rows-1)*cols+i,(rows-1)*cols+j,(2*rows-1)*cols+j,(2*rows-1)*cols+i))
data=bpy.data.meshes.new('Closed swept hair shell');data.from_pydata(verts,[],faces);data.update()
cap=bpy.data.objects.new('Hair cap',data);bpy.context.collection.objects.link(cap);finish(cap,'Hair cap',hair)
hair_bulk=[cap]
for i in range(13):
    a=i/13*2*math.pi
    centre=(.02+.14*math.cos(a),.07+.12*math.sin(a),2.82+.085*math.sin(a*2+.4))
    obj=ellipsoid('Bun foundation',centre,(.115,.10,.125),hair,None,20,14)
    obj.rotation_euler=(.2*math.cos(a),.3*math.sin(a),a)
    hair_bulk.append(obj)
hair_bulk.append(ellipsoid('Bun upper curl',(.045,.07,2.96),(.10,.10,.105),hair,None,20,14))
parts=[obj for obj in parts if obj not in hair_bulk or obj==cap]
bpy.ops.object.select_all(action='DESELECT')
for obj in hair_bulk:obj.select_set(True)
bpy.context.view_layer.objects.active=cap;bpy.ops.object.join()
cap.name='Connected swept hair and messy bun'
remesh=cap.modifiers.new('Organic hair union','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.0135;remesh.use_smooth_shade=True
bpy.ops.object.modifier_apply(modifier=remesh.name)
smooth=cap.modifiers.new('Soft curl junctions','SMOOTH');smooth.factor=.45;smooth.iterations=3;bpy.ops.object.modifier_apply(modifier=smooth.name)
dec=cap.modifiers.new('Preview mesh budget','DECIMATE');dec.ratio=.55;bpy.ops.object.modifier_apply(modifier=dec.name)
bindings.append((cap,'Head'))
for p in cap.data.polygons:p.use_smooth=True
for sign in [-1,1]:
    for i in range(6):
        x=sign*(.08+i*.049)
        surface_points=[]
        for px,pz in [(x,2.54+abs(x)*.10),(x*.85,2.60),(x*.60,2.66),(x*.25,2.695)]:
            py=.017-.366*math.sqrt(max(.001,1-(px/.442)**2-((pz-2.23)/.49)**2))-.001
            surface_points.append((px,py,pz))
        curve('Scalp conforming fine hair detail',surface_points,.003 if i%2 else .004,hair_light if i%3 else hair_dark,'Head',2,True)
    # A loose cheek-framing curl, deliberately irregular rather than a spring.
    curve('Loose face curl.'+str(sign),[(sign*.34,-.19,2.55),(sign*.43,-.18,2.40),(sign*.41,-.22,2.28),(sign*.455,-.24,2.15),(sign*.42,-.25,2.03),(sign*.455,-.24,1.97)],.0038,hair_light,'Head',3,True)
for i in range(10):
    a=i/10*math.pi*2
    bx=.04+.18*math.cos(a);by=.07+.14*math.sin(a);bz=2.93+.06*math.sin(a*2)
    points=[]
    for j in range(9):
        t=j/8
        points.append((bx+.045*math.cos(a+t*math.pi*2),by+.045*math.sin(a+t*math.pi*2),bz+.13*t+.025*math.sin(t*math.pi*2)))
    curve('Fine flyaway curl',points,.0025,hair_light if i%2 else hair,'Head',2,True)

# A real hierarchy supports the preview's subtle head/eye/breathing animation.
bpy.ops.object.armature_add(enter_editmode=True,location=(0,0,0))
rig=bpy.context.object;rig.name='NurseAlya_Preview_Rig';rig.data.name='NurseAlya_Preview_Skeleton'
for bone in list(rig.data.edit_bones):rig.data.edit_bones.remove(bone)
bones={}
def bone(name,head,tail,parent=None):
    b=rig.data.edit_bones.new(name);b.head=head;b.tail=tail
    if parent:b.parent=bones[parent]
    bones[name]=b
bone('Root',(0,0,0),(0,0,.45))
bone('Hips',(0,0,.73),(0,0,.98),'Root')
bone('Spine',(0,0,.98),(0,0,1.57),'Hips')
bone('Neck',(0,0,1.57),(0,0,1.83),'Spine')
bone('Head',(0,0,1.83),(0,0,2.58),'Neck')
for sign,side in [(-1,'L'),(1,'R')]:
    bone('Eye.'+side,(sign*.155,-.287,2.285),(sign*.155,-.287,2.36),'Head')
    points=crossed[side]
    bone('UpperArm.'+side,points[0],points[1],'Spine')
    bone('Forearm.'+side,points[1],points[2],'UpperArm.'+side)
    bone('Hand.'+side,points[2],(points[2][0],points[2][1],points[2][2]-.09),'Forearm.'+side)
    bone('Thigh.'+side,(sign*.17,0,.82),(sign*.17,0,.45),'Hips')
    bone('Shin.'+side,(sign*.17,0,.45),(sign*.17,0,.12),'Thigh.'+side)
for row in lid_rows:
    pos=Vector(row['pos']);bone(row['name'],pos,pos+Vector((0,0,.03)),'Head')
bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True
for obj,bone_name in bindings:
    if obj.name not in bpy.data.objects:continue
    group=obj.vertex_groups.new(name=bone_name);group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
for obj in parts:
    if obj.name not in bpy.data.objects or obj.type!='MESH':continue
    mod=obj.modifiers.new('Preview skeletal rig','ARMATURE');mod.object=rig;obj.parent=rig
for pb in rig.pose.bones:pb.rotation_mode='XYZ'
scene=bpy.context.scene;scene.render.fps=24;scene.frame_start=1;scene.frame_end=192
actions=[]
for name in ['idle','breath','blink','headtilt']:
    action=bpy.data.actions.new(name);action.use_fake_user=True;rig.animation_data_create();rig.animation_data.action=action
    for frame in range(1,194,2):
        scene.frame_set(frame);t=(frame-1)/192
        for pb in rig.pose.bones:pb.location=(0,0,0);pb.rotation_euler=(0,0,0);pb.scale=(1,1,1)
        breathe=math.sin(t*math.pi*4)
        if name in ['idle','breath']:
            rig.pose.bones['Spine'].scale.y=1+.006*breathe
            rig.pose.bones['Neck'].rotation_euler[0]=.008*math.sin(t*math.pi*2)
        if name in ['idle','headtilt']:
            rig.pose.bones['Head'].rotation_euler[1]=.026*math.sin(t*math.pi*2)
            rig.pose.bones['Head'].rotation_euler[2]=.040*math.sin(t*math.pi*2)
        closedness=0
        if name in ['idle','blink']:
            for centre in [40/192,138/192]:
                distance=abs(t-centre)
                if distance<.018:closedness=max(closedness,1-distance/.018)
        for row in lid_rows:
            theta=row['rest']+(row['closed']-row['rest'])*closedness
            ratio=math.sin(theta)/math.sin(row['rest'])
            pb=rig.pose.bones[row['name']]
            pb.scale=(ratio,1,ratio)
            pb.location.y=row['rz']*(math.cos(theta)-math.cos(row['rest']))
        for pb in rig.pose.bones:
            pb.keyframe_insert(data_path='location',frame=frame,group=pb.name)
            pb.keyframe_insert(data_path='rotation_euler',frame=frame,group=pb.name)
            pb.keyframe_insert(data_path='scale',frame=frame,group=pb.name)
    for fc in action.fcurves:
        for key in fc.keyframe_points:key.interpolation='LINEAR'
    actions.append(action)
rig.animation_data.action=actions[0];scene.frame_set(1)
rig['preview_only']=True
rig['note']='Original nurse character preview. Crossed arms remain fixed; subtle breath/head motion and real skin eyelids; eyes keep their shape.'
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for obj in parts:
    if obj.name in bpy.data.objects:obj.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/'nurse-alya-preview.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_range=False,export_skins=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_yup=True)

# A clean portrait composition follows the user's white-background reference.
world=bpy.data.worlds.new('Soft offwhite portrait world');world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.95,.95,.91,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.65
world_nodes=world.node_tree.nodes;world_links=world.node_tree.links
visible_bg=world_nodes.new('ShaderNodeBackground');visible_bg.inputs['Color'].default_value=(16,16,16,1);visible_bg.inputs['Strength'].default_value=1
light_path=world_nodes.new('ShaderNodeLightPath');mix=world_nodes.new('ShaderNodeMixShader')
world_links.new(light_path.outputs['Is Camera Ray'],mix.inputs[0]);world_links.new(world_nodes['Background'].outputs[0],mix.inputs[1]);world_links.new(visible_bg.outputs[0],mix.inputs[2]);world_links.new(mix.outputs[0],world_nodes['World Output'].inputs['Surface']);scene.world=world
focus=Vector((0,-.01,2.03))
for name,loc,power,size,color in [('Portrait softbox',(-3,-4,5.5),420,4,(1,.89,.79)),('Front bounce',(3,-4,3.8),250,4,(.88,.94,1)),('Hair rim',(1,2,5),380,3,(1,.85,.70))]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=loc;obj.rotation_euler=(focus-obj.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(.20,-8,2.40))
camera=bpy.context.object;camera.name='Reference portrait camera';camera.data.type='ORTHO';camera.data.ortho_scale=2.65
camera.rotation_euler=(focus-camera.location).to_track_quat('-Z','Y').to_euler();scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=80;scene.cycles.use_denoising=False
scene.render.resolution_x=700;scene.render.resolution_y=1050;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(OUT/'Nurse-Alya-Preview.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Nurse-Alya-Preview.blend'))
bpy.ops.render.render(write_still=True)
meshes=[obj for obj in parts if obj.name in bpy.data.objects and obj.type=='MESH']
summary={'meshes':len(meshes),'vertices':sum(len(obj.data.vertices) for obj in meshes),'bones':len(rig.data.bones),'actions':[a.name for a in actions],'glb_bytes':(OUT/'nurse-alya-preview.glb').stat().st_size,'blend_bytes':(OUT/'Nurse-Alya-Preview.blend').stat().st_size}
print('NURSE_PREVIEW_VALIDATION',json.dumps(summary))
