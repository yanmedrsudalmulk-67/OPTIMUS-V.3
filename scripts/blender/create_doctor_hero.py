"""Build an original, editable and animated child doctor hero in Blender.

Run from the repository root:
  blender -b --factory-startup --python scripts/blender/create_doctor_hero.py

Blender 4.3+, no downloaded models, textures or add-ons are required.
Coordinates use Blender Z up, front -Y; glTF export converts to Y up/front +Z.
"""
import bpy
import math
import random
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path.cwd()
OUT = ROOT / 'design'
GLB = ROOT / 'apps/web/public/models/doctor-hero.glb'
OUT.mkdir(parents=True, exist_ok=True)
GLB.parent.mkdir(parents=True, exist_ok=True)
random.seed(24)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for data in bpy.data.actions:
    bpy.data.actions.remove(data)

def material(name, color, roughness=.6, subsurface=0, metallic=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if 'Subsurface Weight' in bsdf.inputs:
        bsdf.inputs['Subsurface Weight'].default_value = subsurface
        bsdf.inputs['Subsurface Radius'].default_value = (1, .45, .25)
    return m

skin = material('Warm skin', (.66, .34, .17), .66, .075)
skin_light = material('Nose and ears', (.70, .36, .18), .66, .08)
ear_inner = material('Ear soft inner', (.52, .215, .115), .74)
blush = material('Cheek warmth', (.70, .315, .17), .8)
hair = material('Chocolate curls', (.062, .029, .013), .78)
hair_hi = material('Warm curl highlights', (.10, .048, .021), .75)
eye = material('Dark eyes', (.012, .007, .004), .2)
catchlight = material('Eye reflections', (.96, .95, .86), .17)
mouth = material('Soft expression', (.24, .085, .035), .8)
coat = material('Ivory cotton coat', (.88, .86, .78), .87)
coat_edge = material('Coat seams', (.66, .66, .56), .9)
scrubs = material('Sage scrub shirt', (.17, .30, .19), .86)
pants = material('Deep sage trousers', (.10, .19, .13), .9)
accent = material('TeamAccent', (.08, .54, .41), .65)
shoe = material('Sand canvas shoes', (.58, .43, .22), .86)
sole = material('Cream rubber soles', (.76, .66, .43), .9)
lace = material('Cotton laces', (.82, .75, .55), .87)
tube_mat = material('Stethoscope tubing', (.055, .10, .09), .56)
steel = material('Brushed stethoscope', (.40, .48, .47), .35, metallic=.45)
badge_white = material('Badge card', (.94, .94, .86), .7)

parts = []
bindings = []

def finish(obj, name, mat, bone=None):
    obj.name = name
    if mat:
        obj.data.materials.append(mat)
    if obj.type == 'MESH':
        for p in obj.data.polygons:
            p.use_smooth = True
    parts.append(obj)
    if bone:
        bindings.append((obj, bone))
    return obj

def ellipsoid(name, center, size, mat, bone=None, segments=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=center)
    obj = bpy.context.object
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat, bone)

def cube(name, center, size, mat, bone=None, bevel=.03):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new('Soft sewn edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(obj, name, mat, bone)

def curve(name, points, radius, mat, bone=None, resolution=3):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.resolution_u = 12
    data.bevel_depth = radius
    data.bevel_resolution = resolution
    spline = data.splines.new('BEZIER')
    spline.bezier_points.add(len(points) - 1)
    for p, co in zip(spline.bezier_points, points):
        p.co = co
        p.handle_left_type = p.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
    return finish(obj, name, mat, bone)

def ring_mesh(name, rings, mat, bone=None, sides=28, gap=0):
    verts, faces = [], []
    for z, wx, dy, cy in rings:
        for i in range(sides):
            phi = -math.pi / 2 + gap + (2 * math.pi - 2 * gap) * i / (sides - 1 if gap else sides)
            # Rounded squircle rather than a stack of spheres: broad soft cloth.
            x = wx * math.copysign(abs(math.cos(phi)) ** .84, math.cos(phi))
            y = cy + dy * math.copysign(abs(math.sin(phi)) ** .90, math.sin(phi))
            verts.append((x, y, z))
    for r in range(len(rings)-1):
        for i in range(sides - 1 if gap else sides):
            j = (i + 1) % sides
            faces.append((r*sides+i, r*sides+j, (r+1)*sides+j, (r+1)*sides+i))
    if not gap:
        faces.append(tuple(reversed(range(sides))))
        faces.append(tuple((len(rings)-1)*sides+i for i in range(sides)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    finish(obj, name, mat, bone)
    mod = obj.modifiers.new('Tailored subdivision', 'SUBSURF')
    mod.levels = 1
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    if gap:
        solid = obj.modifiers.new('Cloth thickness', 'SOLIDIFY')
        solid.thickness = .018
        bpy.ops.object.modifier_apply(modifier=solid.name)
    return obj

def limb_mesh(name, points, radii, mat, upper, lower):
    verts, faces, weights = [], [], []
    # Smooth tapered limb with several rings around the elbow/knee.
    count = 13
    points = [Vector(p) for p in points]
    for r in range(count):
        t = r / (count - 1)
        segment = 0 if t <= .5 else 1
        u = t*2 if segment == 0 else (t-.5)*2
        center = points[segment].lerp(points[segment+1], u)
        radius = radii[segment]*(1-u)+radii[segment+1]*u
        direction = (points[min(segment+1, 2)]-points[segment]).normalized()
        right = Vector((0, 1, 0)).cross(direction).normalized()
        forward = direction.cross(right).normalized()
        for i in range(16):
            angle = i/16*2*math.pi
            verts.append(center + radius*(right*math.cos(angle)+forward*math.sin(angle)))
            low = max(0, min(1, (t-.34)/.32))
            weights.append(low)
        if r:
            for i in range(16):
                j=(i+1)%16
                faces.append(((r-1)*16+i,(r-1)*16+j,r*16+j,r*16+i))
    faces.append(tuple(reversed(range(16))))
    faces.append(tuple((count-1)*16+i for i in range(16)))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    finish(obj,name,mat)
    groups={upper:obj.vertex_groups.new(name=upper),lower:obj.vertex_groups.new(name=lower)}
    for i,lo in enumerate(weights):
        groups[upper].add([i],1-lo,'REPLACE');groups[lower].add([i],lo,'REPLACE')
    mod=obj.modifiers.new('Continuous soft limb','SUBSURF');mod.levels=1
    bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj

# Body: a continuous softly tapered shirt and open, layered coat.
ring_mesh('Sage scrub tunic',[(.84,.25,.16,0),(.88,.29,.18,0),(1.03,.28,.18,0),(1.31,.31,.19,0),(1.48,.33,.18,0),(1.57,.25,.15,0),(1.62,.14,.12,0)],scrubs,'Spine')
ring_mesh('Open ivory medical coat',[(.78,.29,.195,.025),(.82,.32,.21,.025),(1.02,.30,.205,.025),(1.30,.33,.215,.025),(1.47,.35,.20,.025),(1.55,.28,.17,.025),(1.60,.145,.135,.025)],coat,'Spine',sides=32,gap=.30)
ellipsoid('Neck',(0,0,1.665),(.13,.115,.16),skin,'Neck')
for sign, side in [(-1,'L'),(1,'R')]:
    # Lapels are a soft, closed polygon with rounded edges.
    coords=[(sign*.12,-.173,1.59),(sign*.24,-.197,1.44),(sign*.13,-.234,1.30),(sign*.055,-.225,1.48)]
    mesh=bpy.data.meshes.new('Lapel');mesh.from_pydata(coords,[],[(0,1,2,3)]);mesh.update()
    lapel=bpy.data.objects.new('Coat lapel.'+side,mesh);bpy.context.collection.objects.link(lapel);finish(lapel,lapel.name,coat,'Spine')
    mod=lapel.modifiers.new('Lapel thickness','SOLIDIFY');mod.thickness=.022;bpy.context.view_layer.objects.active=lapel;bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=lapel.modifiers.new('Rounded lapel','BEVEL');mod.width=.018;mod.segments=3;bpy.ops.object.modifier_apply(modifier=mod.name)
    pocket=cube('Coat pocket.'+side,(sign*.20,-.197,1.03),(.155,.028,.14),coat,'Spine',.025)
    curve('Pocket stitching.'+side,[(sign*.265,-.219,1.085),(sign*.20,-.223,1.075),(sign*.135,-.219,1.085)],.004,coat_edge,'Spine',2)
for z in [1.24,1.10,.96]:
    ellipsoid('Pearl coat button',(0.092,-.217,z),(.018,.012,.018),coat_edge,'Spine',16,10)

# Badge and a subtle coloured team tab remain visible without loud body panels.
cube('ID card',(0.205,-.237,1.35),(.112,.018,.145),badge_white,'Spine',.012)
cube('Team badge stripe',(0.205,-.250,1.39),(.09,.006,.027),accent,'Spine',.004)
for z in [1.35,1.326]:cube('ID detail',(0.202,-.251,z),(.064,.004,.007),coat_edge,'Spine',.002)
curve('Badge lanyard',[(.14,-.182,1.57),(.176,-.22,1.49),(.205,-.237,1.43)],.009,accent,'Spine')

# Deliberately recognizable stethoscope rather than a painted texture.
curve('Stethoscope', [(-.13,-.145,1.63),(-.22,-.235,1.47),(-.235,-.255,1.24),(-.13,-.27,1.15),(.03,-.273,1.20),(.10,-.248,1.42),(.13,-.145,1.63)],.018,tube_mat,'Spine')
ellipsoid('Stethoscope chest piece',(.025,-.295,1.20),(.055,.018,.055),steel,'Spine',20,12)
ellipsoid('Stethoscope diaphragm',(.025,-.315,1.20),(.040,.008,.040),tube_mat,'Spine',20,12)

# Head uses a deliberately shaped surface: fuller cheeks, tapered chin and rounded skull.
head=ellipsoid('Sculpted child face',(0,0,2.125),(.37,.305,.425),skin,'Head',40,28)
for v in head.data.vertices:
    local=v.co
    zn=local.z/.425
    local.x*=1 + .075*math.exp(-((zn+.20)/.42)**2)-.12*max(0,-zn)**2
    if local.y < 0:
        local.y*=1+.07*math.exp(-((zn+.30)/.38)**2)
for sign, side in [(-1,'L'),(1,'R')]:
    ellipsoid('Ear.'+side,(sign*.363,-.005,2.12),(.092,.063,.125),skin_light,'Head',22,14)
    ellipsoid('Ear concha.'+side,(sign*.392,-.055,2.123),(.042,.018,.072),ear_inner,'Head',18,12)
    ellipsoid('Eye.'+side,(sign*.127,-.297,2.17),(.033,.016,.046),eye,'Eye.'+side,24,16)
    ellipsoid('Eye catchlight.'+side,(sign*.127-.009,-.313,2.188),(.008,.004,.010),catchlight,'Eye.'+side,12,8)
    curve('Eyebrow.'+side,[(sign*.085,-.292,2.282),(sign*.125,-.298,2.293),(sign*.169,-.284,2.28)],.013,hair,'Head')
ellipsoid('Soft round nose',(0,-.315,2.104),(.052,.063,.065),skin_light,'Head',28,18)
curve('Subtle smile',[(-.076,-.287,1.986),(-.032,-.309,1.976),(.032,-.309,1.976),(.076,-.287,1.986)],.006,mouth,'Head',3)

# Hair cap follows the back/side of the skull; front limit leaves a soft forehead.
verts=[(0,0,2.58)];faces=[];cap_rows=12;cap_cols=36
for r in range(1,cap_rows+1):
    for i in range(cap_cols):
        phi=i/cap_cols*2*math.pi
        front=max(0,-math.sin(phi))
        limit=1.58-.48*front**4
        theta=limit*r/cap_rows
        rr=1+.018*math.sin(i*2.7+r*.8)
        verts.append((.387*math.sin(theta)*math.cos(phi)*rr,.322*math.sin(theta)*math.sin(phi)*rr,2.125+.443*math.cos(theta)))
for i in range(cap_cols):faces.append((0,1+i,1+(i+1)%cap_cols))
for r in range(cap_rows-1):
    for i in range(cap_cols):
        j=(i+1)%cap_cols;a=1+r*cap_cols;b=a+cap_cols
        faces.append((a+i,b+i,b+j,a+j))
mesh=bpy.data.meshes.new('Organic hair cap');mesh.from_pydata(verts,[],faces);mesh.update()
obj=bpy.data.objects.new('Organic hair cap',mesh);bpy.context.collection.objects.link(obj);finish(obj,obj.name,hair,'Head')
# Short irregular curls share the cap colour, with small varied highlights.
for r,(theta,n) in enumerate([(.27,6),(.58,10),(.89,13),(1.13,13)]):
    for i in range(n):
        phi=i/n*2*math.pi+(r%2)*.22
        if r==3 and math.sin(phi)<-.58:continue
        t=theta+random.uniform(-.08,.08)
        x=.37*math.sin(t)*math.cos(phi);y=.305*math.sin(t)*math.sin(phi);z=2.125+.44*math.cos(t)
        size=random.uniform(.067,.092)
        curl=ellipsoid('Hair curl', (x,y,z), (size*1.18,size*.87,size*.76), hair_hi if (i+r)%6==0 else hair,'Head',16,10)
        curl.rotation_euler=(random.uniform(-.4,.4),random.uniform(-.4,.4),phi*.7)
for x,z,rz in [(-.245,2.398,-.35),(-.13,2.435,.2),(-.015,2.43,-.2),(.105,2.438,.4),(.22,2.403,.6)]:
    o=ellipsoid('Forehead curl',(x,-.245,z),(.083,.081,.106),hair,'Head',18,12)
    o.rotation_euler=(.23,rz,.2)

# Join the cap and curls into one continuous organic hair surface. Small
# overlapping spheres are merely construction tools, not the exported topology.
hair_parts=[o for o in parts if o.name.startswith(('Organic hair cap','Hair curl','Forehead curl'))]
cap=next(o for o in hair_parts if o.name=='Organic hair cap')
bpy.context.view_layer.objects.active=cap
solid=cap.modifiers.new('Closed hair base','SOLIDIFY');solid.thickness=.045
bpy.ops.object.modifier_apply(modifier=solid.name)
bpy.ops.object.select_all(action='DESELECT')
for o in hair_parts:o.select_set(True)
bpy.context.view_layer.objects.active=cap
bpy.ops.object.join()
cap.name='Unified soft curly hair'
remesh=cap.modifiers.new('Connected curl topology','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.016;remesh.use_smooth_shade=True
bpy.ops.object.modifier_apply(modifier=remesh.name)
smooth=cap.modifiers.new('Soften curl transitions','SMOOTH');smooth.factor=.65;smooth.iterations=6
bpy.ops.object.modifier_apply(modifier=smooth.name)
if len(cap.data.polygons)>12000:
    decimate=cap.modifiers.new('Mobile hair topology','DECIMATE');decimate.ratio=12000/len(cap.data.polygons)
    bpy.ops.object.modifier_apply(modifier=decimate.name)
cap.data.materials.clear();cap.data.materials.append(hair)
parts=[o for o in parts if o not in hair_parts]+[cap]
bindings=[(o,b) for o,b in bindings if o not in hair_parts]+[(cap,'Head')]
for p in cap.data.polygons:p.use_smooth=True

# Soft fabric legs, articulated arm sleeves, mitten hands with distinct fingers.
for sign, side in [(-1,'L'),(1,'R')]:
    hip=(sign*.15,.015,.93);knee=(sign*.16,.018,.55);ankle=(sign*.17,.012,.20)
    limb_mesh('Tailored trousers.'+side,[hip,knee,ankle],[.147,.115,.105],pants,'Thigh.'+side,'Shin.'+side)
    # Rounded hip volume stays under coat and prevents split pelvis holes.
    ellipsoid('Trouser hip.'+side,(sign*.139,.015,.87),(.15,.165,.19),pants,'Hips',24,14)
    shoulder=(sign*.325,.01,1.515);elbow=(sign*.48,.00,1.20);palm=(sign*.51,-.035,.85)
    limb_mesh('Coat sleeve.'+side,[shoulder,elbow,palm],[.145,.115,.091],coat,'UpperArm.'+side,'Forearm.'+side)
    # Cuffs are oriented across the arm with a modest turned fabric edge.
    cuff=ellipsoid('Sleeve cuff.'+side,(sign*.506,-.032,.903),(.096,.099,.04),coat_edge,'Forearm.'+side,20,12)
    ellipsoid('Palm.'+side,palm,(.087,.060,.105),skin,'Hand.'+side,24,16)
    ellipsoid('Thumb.'+side,(sign*.438,-.079,.857),(.036,.04,.063),skin,'Hand.'+side,18,12)
    for j in range(4):
        xx=sign*(.456+j*.034)
        ellipsoid('Finger.%s.%s'%(side,j+1),(xx,-.04,.781-abs(j-1.5)*.007),(.021,.042,.058),skin,'Hand.'+side,14,10)
    # Clean low-top shoes: rounded toe, sole, tongue and actual lace curves.
    cube('Rubber sole.'+side,(sign*.17,-.095,.072),(.265,.425,.105),sole,'Foot.'+side,.045)
    shoe_obj=cube('Canvas shoe.'+side,(sign*.17,-.095,.146),(.252,.389,.157),shoe,'Foot.'+side,.065)
    tongue=cube('Shoe tongue.'+side,(sign*.17,-.075,.226),(.14,.19,.025),shoe,'Foot.'+side,.015)
    for i in range(3):
        y=-.055-i*.045
        curve('Lace.%s.%s'%(side,i),[(sign*.17-.065,y,.226),(sign*.17,y-.013,.241),(sign*.17+.065,y,.226)],.008,lace,'Foot.'+side,2)
    curve('Sole seam.'+side,[(sign*.17-.11,-.24,.105),(sign*.17,-.29,.11),(sign*.17+.11,-.24,.105)],.005,lace,'Foot.'+side,2)

# A true deform armature. IK controllers keep rope hand centres fixed.
bpy.ops.object.armature_add(enter_editmode=True, location=(0,0,0))
rig=bpy.context.object;rig.name='DoctorHero_Rig';rig.data.name='DoctorHero_Skeleton'
for b in list(rig.data.edit_bones):rig.data.edit_bones.remove(b)
bones={}
def bone(name, head, tail, parent=None, deform=True):
    b=rig.data.edit_bones.new(name);b.head=head;b.tail=tail;b.use_deform=deform
    if parent:b.parent=bones[parent]
    bones[name]=b;return b
bone('Root',(0,0,0),(0,0,.4))
bone('Hips',(0,0,.82),(0,0,1.03),'Root')
bone('Spine',(0,0,1.03),(0,0,1.54),'Hips')
bone('Neck',(0,0,1.54),(0,0,1.78),'Spine')
bone('Head',(0,0,1.78),(0,0,2.4),'Neck')
for sign, side in [(-1,'L'),(1,'R')]:
    bone('Eye.'+side,(sign*.127,-.297,2.17),(sign*.127,-.297,2.21),'Head')
    bone('UpperArm.'+side,(sign*.325,.01,1.515),(sign*.48,0,1.20),'Spine')
    bone('Forearm.'+side,(sign*.48,0,1.20),(sign*.51,-.035,.85),'UpperArm.'+side)
    bone('Hand.'+side,(sign*.51,-.035,.85),(sign*.51,-.035,.70),'Forearm.'+side)
    bone('Grip.'+side,(sign*.51,-.035,.85),(sign*.51,-.035,.70),'Root',False)
    bone('ElbowPole.'+side,(sign*.85,-.35,1.24),(sign*.85,-.35,1.34),'Root',False)
    bone('Thigh.'+side,(sign*.15,.015,.93),(sign*.16,.018,.55),'Hips')
    bone('Shin.'+side,(sign*.16,.018,.55),(sign*.17,.012,.20),'Thigh.'+side)
    bone('Foot.'+side,(sign*.17,.012,.20),(sign*.17,-.21,.12),'Shin.'+side)
bpy.ops.object.mode_set(mode='OBJECT')
rig.show_in_front=True
for pb in rig.pose.bones:pb.rotation_mode='XYZ'
for sign,side in [(-1,'L'),(1,'R')]:
    con=rig.pose.bones['Forearm.'+side].constraints.new('IK')
    con.name='Stable rope hand IK';con.target=rig;con.subtarget='Grip.'+side;con.chain_count=2
    con.use_stretch=True
    con.pole_target=rig;con.pole_subtarget='ElbowPole.'+side
    con.pole_angle=(-math.pi/2 if side=='L' else math.pi/2)
    rig.pose.bones['UpperArm.'+side].ik_stretch=.08
    rig.pose.bones['Forearm.'+side].ik_stretch=.08
    # Independent palm orientation avoids the unwanted elbow pole twist.
    hand_orientation=rig.pose.bones['Hand.'+side].constraints.new('COPY_ROTATION')
    hand_orientation.name='Palm orientation';hand_orientation.target=rig;hand_orientation.subtarget='Grip.'+side
    hand_orientation.owner_space='WORLD';hand_orientation.target_space='WORLD'

for obj,name in bindings:
    group=obj.vertex_groups.new(name=name);group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
for obj in parts:
    if obj.type!='MESH':continue
    mod=obj.modifiers.new('DoctorHero skeletal deformation','ARMATURE');mod.object=rig
    obj.parent=rig

# Blender action poses. All channels are keyed so clips crossfade cleanly.
scene=bpy.context.scene
scene.render.fps=24
scene.frame_start=1
scene.frame_end=96
actions=[]
rest_grips={s:Vector((sign*.51,-.035,.85)) for sign,s in [(-1,'L'),(1,'R')]}
def set_world_target(side,target):
    pb=rig.pose.bones['Grip.'+side]
    # Rest bone local axes are not world XYZ, so map desired translation.
    rest=rig.data.bones[pb.name]
    delta=Vector(target)-rest.head_local
    pb.location=rest.matrix_local.to_3x3().inverted()@delta

def pose_for(name,t):
    for pb in rig.pose.bones:
        pb.location=(0,0,0);pb.rotation_euler=(0,0,0);pb.scale=(1,1,1)
    breath=math.sin(t*2*math.pi)
    spine=rig.pose.bones['Spine'];head_pb=rig.pose.bones['Head'];hips_pb=rig.pose.bones['Hips']
    spine.scale=(1,1+.009*breath,1)
    head_pb.rotation_euler[2]=math.sin(t*2*math.pi)*.025
    head_pb.rotation_euler[0]=math.sin(t*2*math.pi+.4)*.012
    # Pose all IK targets every clip, including the idle/rest case.
    for sign,side in [(-1,'L'),(1,'R')]:set_world_target(side,rest_grips[side])
    if name=='idle':
        for sign,side in [(-1,'L'),(1,'R')]:set_world_target(side,(sign*.51,-.035-.01*breath,.85+.01*breath))
    if name=='ready':
        spine.rotation_euler[0]=.025
        for sign,side in [(-1,'L'),(1,'R')]:
            set_world_target(side,(sign*.35,-.14,1.035+.004*breath))
            rig.pose.bones['Grip.'+side].rotation_euler[1]=sign*.25
    if name in ('rope-ready','pulling','struggling','sliding'):
        spine.rotation_euler[0]=.35+(0 if name=='rope-ready' else .035*breath)
        head_pb.rotation_euler[0]=-.17
        for sign,side in [(-1,'L'),(1,'R')]:
            set_world_target(side,(sign*.12,-.67,1.05))
            rig.pose.bones['Grip.'+side].rotation_euler[1]=sign*.68
            rig.pose.bones['Thigh.'+side].rotation_euler[0]=(-.10 if side=='L' else .10)
            rig.pose.bones['Shin.'+side].rotation_euler[0]=.10
        if name=='struggling':
            head_pb.rotation_euler[2]=.05*breath
        if name=='sliding':
            hips_pb.rotation_euler[1]=.025*breath
    if name=='victory':
        rig.pose.bones['Root'].location.y=.025*(1-math.cos(t*4*math.pi))
        for sign,side in [(-1,'L'),(1,'R')]:set_world_target(side,(sign*.52,-.12,2.12+.04*breath))
        spine.rotation_euler[2]=.045*breath
    if name in ('falling','defeat'):
        rig.pose.bones['Root'].rotation_euler[2]=.65 if name=='falling' else .20
        spine.rotation_euler[0]=.20
        head_pb.rotation_euler[0]=.13
        for sign,side in [(-1,'L'),(1,'R')]:set_world_target(side,(sign*.45,-.10,.90))
    # Eye bones scale along their local Y, the vertical axis in rest space.
    blink_phase=(t*2)%1
    blink=1-.94*math.sin(blink_phase/.10*math.pi) if blink_phase<.10 else 1
    for side in ['L','R']:rig.pose.bones['Eye.'+side].scale.y=blink

for name in ['idle','ready','rope-ready','pulling','struggling','sliding','falling','victory','defeat']:
    action=bpy.data.actions.new(name);rig.animation_data_create();rig.animation_data.action=action
    action.use_fake_user=True
    for frame in range(1,98,2):
        scene.frame_set(frame);pose_for(name,(frame-1)/96)
        for pb in rig.pose.bones:
            pb.keyframe_insert(data_path='location',frame=frame,group=pb.name)
            pb.keyframe_insert(data_path='rotation_euler',frame=frame,group=pb.name)
            pb.keyframe_insert(data_path='scale',frame=frame,group=pb.name)
    for fc in action.fcurves:
        for k in fc.keyframe_points:k.interpolation='LINEAR'
    actions.append(action)
rig.animation_data.action=actions[1]
scene.frame_set(25)

# Mark useful semantic metadata in the deliverable.
rig['description']='Original Blender-built child doctor hero; nine baked export actions.'
rig['forward']='Blender -Y / glTF +Z'
rig['rope_grip_gltf']='Hand.L=(-0.12,1.05,0.67), Hand.R=(0.12,1.05,0.67)'

# Export only the rig and actual model, keeping stage/camera out of the game.
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
for obj in parts:obj.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(GLB),export_format='GLB',use_selection=True,
    export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,
    export_frame_range=False,export_skins=True,export_all_influences=False,
    export_materials='EXPORT',export_cameras=False,export_lights=False,
    export_yup=True,export_apply=False)

# Soft studio scene is stored in the .blend as a review-friendly presentation.
stage=material('Studio warm grey',(.72,.76,.74),.94)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,.007))
floor=bpy.context.object;floor.name='Studio Ground';floor.data.materials.append(stage)
world=bpy.data.worlds.new('Soft studio environment');world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.78,.83,.86,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.6;scene.world=world
focus=Vector((0,0,1.35))
for name,loc,power,size,color in [('Large warm key',(-3,-4,6),380,4,(1,.90,.77)),('Soft frontal fill',(3,-4,4),220,4,(.8,.90,1)),('Hair rim',(2,2,5),350,3,(1,.84,.65))]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=loc;obj.rotation_euler=(focus-obj.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(3.1,-8,3.0))
camera=bpy.context.object;camera.name='Hero portrait camera';camera.data.type='ORTHO';camera.data.ortho_scale=3.3
camera.rotation_euler=(focus-camera.location).to_track_quat('-Z','Y').to_euler();scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=96;scene.cycles.use_denoising=False
scene.render.resolution_x=700;scene.render.resolution_y=850;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.render.filepath=str(OUT/'Doctor-Hero-Rigged-preview.png')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Doctor-Hero-Rigged.blend'))
bpy.ops.render.render(write_still=True)

mesh_objects=[o for o in parts if o.type=='MESH']
summary={'meshes':len(mesh_objects),'vertices':sum(len(o.data.vertices) for o in mesh_objects),'actions':[a.name for a in actions],'bones':len(rig.data.bones),'glb_bytes':GLB.stat().st_size,'blend_bytes':(OUT/'Doctor-Hero-Rigged.blend').stat().st_size}
print('DOCTOR_HERO_VALIDATION',json.dumps(summary))
