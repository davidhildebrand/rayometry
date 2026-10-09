const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=__dirname+'/';
const elements=new Map();
class Element {
 constructor(id){this.id=id;this.value='';this.checked=false;this.disabled=false;this.hidden=false;this.textContent='';this.innerHTML='';this.handlers={};this.attrs={};}
 addEventListener(name,fn){this.handlers[name]=fn;}
 setAttribute(name,value){this.attrs[name]=String(value);}
 setPointerCapture(){}
 getScreenCTM(){return {inverse:()=>({})};}
}
const document={getElementById(id){if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);}};
const frames=[];
const ctx=vm.createContext({document,console,DOMPoint:class{constructor(x,y){this.x=x;this.y=y;}matrixTransform(){return this;}},requestAnimationFrame:cb=>{frames.push(cb);return frames.length;}});
for(const name of ['physics.js','scene.js','measurements.js','app.js'])vm.runInContext(fs.readFileSync(root+name,'utf8'),ctx);
const $=id=>document.getElementById(id),change=(id,value)=>{const el=$(id);el.value=String(value);el.valueAsNumber=Number(value);el.onchange({target:el});};
let checks=0;function check(name,fn){fn();checks++;console.log('PASS '+name);}
check('Stylesheet contains CSS and essential layout/ray rules, not application code',()=>{
 const css=fs.readFileSync(root+'styles.css','utf8');
 assert(css.trimStart().startsWith(':root{'));assert(!css.includes('(function(){'));assert(!css.includes('addEventListener'));
 for(const selector of ['main{','svg .ray{','svg .normal{','#controls-panel{','.measurement-options{'])assert(css.includes(selector));
 assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
 assert(fs.readFileSync(root+'index.html','utf8').includes('href="styles.css"'));
});
const initial=$('board').innerHTML;
check('Initial render shows TIR and 50 degrees',()=>assert($('readout').innerHTML.includes('50.0°')&&$('readout').innerHTML.includes('Total internal reflection')));
check('Source numerical rotation updates rays',()=>{change('source-orientation',-70);assert($('readout').innerHTML.includes('20.0°'));assert(!$('readout').innerHTML.includes('Total internal reflection'));});
check('Index edit and invalid-value preservation',()=>{change('block-index',1.6);assert.equal($('block-index').value,1.6);change('block-index',0);assert.equal($('block-index').value,1.6);assert($('message').textContent.includes('previous value'));});
check('Five-ray toggle changes rendered bundle',()=>{change('ray-count',5);assert.equal($('ray-count').value,5);assert(($('board').innerHTML.match(/class="ray"/g)||[]).length>=10);});
check('Inspect locks editing and selects later hit',()=>{$('reset').onclick();$('inspect').onclick();assert($('source-settings').disabled&&$('properties').disabled&&$('media').disabled);assert(!$('board').innerHTML.includes('data-rotate'));$('board').handlers.pointerdown({target:{closest:s=>s==='[data-hit]'?{dataset:{ray:'0',hit:'1'}}:null}});assert.equal($('readout-title').textContent,'Surface 2 · ray 1');assert($('readout').innerHTML.includes('40.0°'));});
check('Return to Edit restores controls',()=>{$('edit').onclick();assert(!$('properties').disabled&&!$('media').disabled);});
check('Surface pivot selection and numerical rotation',()=>{change('pivot-mode','surface');assert.equal($('pivot-mode').value,'surface');assert($('board').innerHTML.includes('>Pivot</text>'));change('source-orientation',-45);assert($('readout').innerHTML.includes('45.0°'));});
check('Switch to source pivot releases lock',()=>{change('pivot-mode','source');assert(!$('board').innerHTML.includes('>Pivot</text>'));});
check('Dragging source moves it outside block',()=>{$('board').handlers.pointerdown({target:{closest:s=>s==='[data-item]'?{dataset:{item:'source'}}:null},clientX:420,clientY:350,pointerId:1});$('board').handlers.pointermove({clientX:150,clientY:350});$('board').handlers.pointerup();change('source-orientation',0);assert($('readout').innerHTML.includes('1 → 1.5'));});
check('Block selection, dragging and orientation work',()=>{$('select-block').onclick();assert(!$('source-properties').hidden);change('block-orientation',15);assert.equal($('block-orientation').value,15);$('board').handlers.pointerdown({target:{closest:s=>s==='[data-item]'?{dataset:{item:'block'}}:null},clientX:500,clientY:325,pointerId:2});$('board').handlers.pointermove({clientX:550,clientY:350});$('board').handlers.pointerup();assert($('board').innerHTML.includes('polygon'));});
check('Normal and angle toggles hide annotations',()=>{for(const id of ['normal','angles']){$(id).checked=false;$(id).onchange({target:$(id)});}assert(!$('board').innerHTML.includes('class="normal"'));assert(!$('board').innerHTML.includes('class="annotation"'));});
check('Reset exactly restores initial drawing and controls',()=>{$('reset').onclick();assert.equal($('board').innerHTML,initial);assert.equal($('source-orientation').value,-40);assert.equal($('ray-count').value,1);assert.equal($('block-index').value,1.5);assert($('normal').checked&&$('angles').checked);});
// Regression checks for persistent rotation mode and actual handle pointer events.
function sourcePose(){const m=$('board').innerHTML.match(/<g transform="translate\(([^ ]+) ([^)]+)\) rotate\(([^)]+)\)" data-item="source"/);return {x:+m[1],y:+m[2],angle:+m[3]};}
function firstHit(){const pose=sourcePose(),scene=ctx.BenchScene.defaults();Object.assign(scene.source,{x:pose.x,y:pose.y,angle:pose.angle*Math.PI/180});return ctx.BenchScene.rays(scene)[0].events[0];}
function moveSource(dx,dy){const p=sourcePose();$('board').handlers.pointerdown({target:{closest:s=>s==='[data-item]'?{dataset:{item:'source'}}:null},clientX:p.x,clientY:p.y,pointerId:3});$('board').handlers.pointermove({clientX:p.x+dx,clientY:p.y+dy});$('board').handlers.pointerup();}
function rotateHandle(degrees){const m=[...$('board').innerHTML.matchAll(/<circle cx="([^"]+)" cy="([^"]+)" r="17"/g)][0];const start={x:+m[1],y:+m[2]},pose=sourcePose(),center=$('pivot-mode').value==='surface'?firstHit().point:pose;const a=degrees*Math.PI/180,dx=start.x-center.x,dy=start.y-center.y;
$('board').handlers.pointerdown({target:{closest:s=>s==='[data-rotate]'?{}:null},clientX:start.x,clientY:start.y,pointerId:4});$('board').handlers.pointermove({clientX:center.x+dx*Math.cos(a)-dy*Math.sin(a),clientY:center.y+dx*Math.sin(a)+dy*Math.cos(a)});$('board').handlers.pointerup();}
check('Surface mode survives source click and translation, preserving direction',()=>{$('reset').onclick();change('pivot-mode','surface');const before=firstHit().point;moveSource(0,0);assert.equal($('pivot-mode').value,'surface');moveSource(20,0);assert.equal($('pivot-mode').value,'surface');assert.equal(sourcePose().angle,-40);assert(Math.abs(firstHit().point.x-before.x-20)<1e-6);});
check('Surface handle rotates about new entry point without jumping',()=>{const hit=firstHit().point,pose=sourcePose();rotateHandle(-5);assert(Math.abs(sourcePose().angle+45)<1e-6);assert(Math.hypot(firstHit().point.x-hit.x,firstHit().point.y-hit.y)<1e-6);assert(Math.hypot(sourcePose().x-pose.x,sourcePose().y-pose.y)>1);assert.equal($('pivot-mode').value,'surface');});
check('Surface handle remains reliable close to surface',()=>{$('reset').onclick();change('pivot-mode','surface');moveSource(0,-120);const hit=firstHit().point;rotateHandle(-5);assert(Math.abs(sourcePose().angle+45)<1e-6);assert(Math.hypot(firstHit().point.x-hit.x,firstHit().point.y-hit.y)<1e-6);});
check('Missing surface retains mode and reacquires pivot on return',()=>{moveSource(0,-150);assert.equal($('pivot-mode').value,'surface');assert(!$('board').innerHTML.includes('>Pivot</text>'));const pose=sourcePose();change('source-orientation',0);assert.equal(sourcePose().angle,pose.angle);moveSource(0,150);assert($('board').innerHTML.includes('>Pivot</text>'));assert.equal($('pivot-mode').value,'surface');});
check('Source handle rotates without translating source',()=>{$('reset').onclick();const before=sourcePose();rotateHandle(10);const after=sourcePose();assert.equal(after.x,before.x);assert.equal(after.y,before.y);assert(Math.abs(after.angle+30)<1e-6);});
check('Block clicks and rotation retain surface mode',()=>{change('pivot-mode','surface');$('select-block').onclick();change('block-orientation',10);assert.equal($('pivot-mode').value,'surface');$('inspect').onclick();$('edit').onclick();assert.equal($('pivot-mode').value,'surface');$('reset').onclick();assert.equal($('pivot-mode').value,'source');});
check('Incident ray drag uses the same gesture with either pivot',()=>{
 for(const mode of ['source','surface']){
  $('reset').onclick();change('pivot-mode',mode);
  assert($('board').innerHTML.includes('pointer-events="stroke" data-rotate="source"'));
  const before=sourcePose(),entry=firstHit().point,center=mode==='surface'?entry:before;
  const a=before.angle*Math.PI/180,start={x:before.x+100*Math.cos(a),y:before.y+100*Math.sin(a)};
  const delta=-5*Math.PI/180,dx=start.x-center.x,dy=start.y-center.y;
  $('select-block').onclick();
  $('board').handlers.pointerdown({target:{closest:s=>s==='[data-rotate]'?{dataset:{rotate:'source'}}:null},clientX:start.x,clientY:start.y,pointerId:5});
  $('board').handlers.pointermove({clientX:center.x+dx*Math.cos(delta)-dy*Math.sin(delta),clientY:center.y+dx*Math.sin(delta)+dy*Math.cos(delta)});
  $('board').handlers.pointerup();
  const after=sourcePose();assert(Math.abs(after.angle+45)<1e-6);assert.equal($('pivot-mode').value,mode);
  if(mode==='source'){assert.equal(after.x,before.x);assert.equal(after.y,before.y);}
  else{const hit=firstHit().point;assert(Math.hypot(hit.x-entry.x,hit.y-entry.y)<1e-6);assert(Math.hypot(after.x-before.x,after.y-before.y)>1);}
 }
 $('reset').onclick();
});
check('Pointer critical snap highlights grazing ray and releases on continued drag',()=>{
 $('reset').onclick();const pose=sourcePose(),a=pose.angle*Math.PI/180,r=100;
 $('board').handlers.pointerdown({target:{closest:s=>s==='[data-rotate]'?{dataset:{rotate:'source'}}:null},clientX:pose.x+r*Math.cos(a),clientY:pose.y+r*Math.sin(a),pointerId:6});
 function move(angle){$('board').handlers.pointermove({clientX:pose.x+r*Math.cos(angle*Math.PI/180),clientY:pose.y+r*Math.sin(angle*Math.PI/180)});}
 move(-48.1);assert($('readout').innerHTML.includes('Critical angle'));assert($('board').innerHTML.includes('class="ray critical-ray"'));assert($('board').innerHTML.includes('θc'));
 for(const angle of [-48.2,-48.3,-48.4,-48.5,-48.6])move(angle);
 assert(!$('readout').innerHTML.includes('Critical angle'));assert(Math.abs(sourcePose().angle+48.6)<1e-6);
 $('board').handlers.pointerup();change('source-orientation',-48.1);assert(Math.abs(sourcePose().angle+48.1)<1e-6);$('reset').onclick();
});
check('Inspect prioritizes readout, highlights selection, and restores Edit sections',()=>{
 $('reset').onclick();$('inspect').onclick();
 for(const id of ['source-panel','toolbox-section','properties-section','media-section','try-section'])assert($(id).hidden);
 assert(!$('inspect-help').hidden);assert.equal($('readout-title').textContent,'Surface 1 · ray 1');
 assert($('board').innerHTML.includes('class="selected-intersection"'));
 $('board').handlers.pointerdown({target:{closest:s=>s==='[data-hit]'?{dataset:{ray:'0',hit:'1'}}:null}});
 assert.equal($('readout-title').textContent,'Surface 2 · ray 1');
 $('edit').onclick();for(const id of ['source-panel','toolbox-section','properties-section','media-section','try-section'])assert(!$(id).hidden);
 assert($('inspect-help').hidden);assert(!$('board').innerHTML.includes('class="selected-intersection"'));
 assert.equal($('readout-title').textContent,'First surface');
});
check('Prism presets render triangles, corner labels and deviation',()=>{
 $('reset').onclick();change('block-index',1.49);change('shape-preset','prism45');
 assert.equal($('shape-preset').value,'prism45');assert.equal($('material-name').textContent,'Prism');
 assert.equal($('block-index').value,1.49);assert($('board').innerHTML.includes('45° apex'));
 assert($('readout').innerHTML.includes('Total deviation'));
 const points=$('board').innerHTML.match(/<polygon points="([^"]+)"/)[1];assert.equal(points.split(' ').length,3);
 $('select-block').onclick();assert.equal($('selected-title').textContent,'45°–45°–90° prism');
 $('inspect').onclick();$('board').handlers.pointerdown({target:{closest:s=>s==='[data-hit]'?{dataset:{ray:'0',hit:'1'}}:null}});
 assert.equal($('readout-title').textContent,'Surface 2 · ray 1');assert($('toolbox-section').hidden);
 $('edit').onclick();for(const key of ['prism30','equilateral']){change('shape-preset',key);assert.equal($('shape-preset').value,key);assert($('board').innerHTML.includes('prism-corner'));}
 change('shape-preset','rectangle');assert(!$('board').innerHTML.includes('prism-corner'));$('reset').onclick();assert.equal($('board').innerHTML,initial);
});
check('Exact angle buttons update the readouts and preserve manual rotation mode',()=>{
 $('reset').onclick();assert($('place-minimum').disabled);$('place-critical').onclick();assert($('readout').innerHTML.includes('Critical angle'));assert.equal($('pivot-mode').value,'source');
 change('shape-preset','prism45');assert(!$('place-minimum').disabled);$('place-minimum').onclick();assert($('readout').innerHTML.includes('Minimum deviation'));assert.equal($('pivot-mode').value,'source');
 $('place-critical').onclick();assert($('readout').innerHTML.includes('Critical at surface 2'));$('reset').onclick();
});
check('Inspect Show all angles includes every normal and restores selected-only view',()=>{
 $('reset').onclick();assert($('show-all-angles').hidden);
 for(const key of ['normal','angles']){$(key).checked=false;$(key).onchange({target:$(key)});}
 $('inspect').onclick();assert(!$('show-all-angles').hidden);
 const normals=()=>($('board').innerHTML.match(/class="normal"/g)||[]).length;
 assert.equal(normals(),0);$('show-all-angles').onclick();assert.equal(normals(),2);
 assert.equal($('show-all-angles').attrs['aria-pressed'],'true');
 $('board').handlers.pointerdown({target:{closest:s=>s==='[data-hit]'?{dataset:{ray:'0',hit:'1'}}:null}});assert.equal(normals(),2);assert.equal($('readout-title').textContent,'Surface 2 · ray 1');
 $('show-all-angles').onclick();assert.equal(normals(),1);
 $('edit').onclick();assert($('show-all-angles').hidden);assert.equal(normals(),1);assert($('normal').checked&&$('angles').checked);
 change('ray-count',5);$('inspect').onclick();$('show-all-angles').onclick();assert.equal(normals(),10);
 $('reset').onclick();assert($('show-all-angles').hidden);assert.equal($('show-all-angles').attrs['aria-pressed'],'false');
});
check('Deviation toggle draws its reference and angle in Edit and Inspect',()=>{
 $('reset').onclick();change('shape-preset','prism45');assert(!$('board').innerHTML.includes('class="deviation-annotation"'));
 $('showDeviation').checked=true;$('showDeviation').onchange({target:$('showDeviation')});assert($('board').innerHTML.includes('class="deviation-reference"'));assert($('board').innerHTML.includes('class="deviation-arc"'));
 $('place-minimum').onclick();assert($('board').innerHTML.includes('δmin'));
 $('inspect').onclick();assert($('board').innerHTML.includes('class="deviation-annotation"'));
 $('showDeviation').checked=false;$('showDeviation').onchange({target:$('showDeviation')});assert(!$('board').innerHTML.includes('class="deviation-annotation"'));
 $('reset').onclick();$('showDeviation').checked=true;$('showDeviation').onchange({target:$('showDeviation')});assert(!$('board').innerHTML.includes('class="deviation-annotation"'));assert($('message').textContent.includes('direct entry-and-exit'));
 $('reset').onclick();assert(!$('showDeviation').checked);
});
check('Semicircle preset offers three rays, curved outline and inspect normals',()=>{
 $('reset').onclick();change('shape-preset','semicircle');assert.equal($('ray-count').value,3);assert.equal($('material-name').textContent,'Semicircle');assert($('board').innerHTML.includes('A 150 150'));assert($('place-minimum').disabled);
 $('select-block').onclick();assert.equal($('selected-title').textContent,'Semicircular block');change('block-orientation',180);
 $('inspect').onclick();$('show-all-angles').onclick();assert.equal(($('board').innerHTML.match(/class="normal"/g)||[]).length,6);
 $('edit').onclick();change('shape-preset','prism45');assert(!$('board').innerHTML.includes('A 150 150'));$('reset').onclick();assert.equal($('board').innerHTML,initial);
});
check('Gold curvature handle changes geometry in local coordinates and hides in Inspect',()=>{
 $('reset').onclick();change('shape-preset','semicircle');$('select-block').onclick();assert($('board').innerHTML.includes('data-curvature'));
 function dragCurve(x,y,toX,toY){$('board').handlers.pointerdown({target:{closest:s=>s==='[data-curvature]'?{}:null},clientX:x,clientY:y,pointerId:8});$('board').handlers.pointermove({clientX:toX,clientY:toY});$('board').handlers.pointerup();}
 dragCurve(600,325,525,325);assert($('board').innerHTML.includes('A 187.5 187.5'));assert($('block-properties').textContent.includes('56.25 mm'));assert.equal($('selected-title').textContent,'Curved block');
 change('block-orientation',90);dragCurve(450,400,450,355);assert($('board').innerHTML.includes('A 390 390'));
 $('inspect').onclick();assert(!$('board').innerHTML.includes('data-curvature'));$('edit').onclick();assert($('board').innerHTML.includes('data-curvature'));
 change('shape-preset','semicircle');assert($('board').innerHTML.includes('A 150 150'));assert(!/SRS|Activity|lab:/.test($('try-content').innerHTML));$('reset').onclick();
});
check('Millimeter grid, exact radius and extensions update through controls',()=>{
 $('reset').onclick();assert($('grid').checked);assert($('board').innerHTML.includes('20 mm'));
 $('grid').checked=false;$('grid').onchange({target:$('grid')});assert(!$('board').innerHTML.includes('fill="url(#grid)"'));
 change('shape-preset','semicircle');$('select-block').onclick();assert(!$('radius-control').hidden);assert.equal($('radius-mm').value,45);
 change('radius-mm',56.25);assert($('board').innerHTML.includes('A 187.5 187.5'));change('radius-mm',2);assert.equal($('radius-mm').value,56.25);assert($('message').textContent.includes('previous curve'));
 change('radius-mm',45);change('block-orientation',180);$('extensions').checked=true;$('extensions').onchange({target:$('extensions')});assert.equal(($('board').innerHTML.match(/class="internal-extension"/g)||[]).length,3);
 $('reset').onclick();assert(!$('extensions').checked&&$('grid').checked);
});
check('Ruler snaps to vertex and center, remains draggable in Inspect, and preserves optics',()=>{
 $('reset').onclick();change('shape-preset','semicircle');$('show-ruler').onclick();assert($('board').innerHTML.includes('60.00 mm'));
 $('inspect').onclick();const source=sourcePose();
 function moveEnd(part,x,y){$('board').handlers.pointerdown({target:{closest:s=>s==='[data-ruler]'?{dataset:{ruler:part}}:null},clientX:700,clientY:550,pointerId:9});$('board').handlers.pointermove({clientX:x,clientY:y});$('board').handlers.pointerup();}
 moveEnd('a',451,326);moveEnd('b',602,325);assert.equal($('ruler-reading').textContent,'Distance: 45.00 mm');assert.deepEqual(sourcePose(),source);assert($('properties').disabled);
 $('ruler-snap').checked=false;$('ruler-snap').onchange({target:$('ruler-snap')});moveEnd('b',650,325);assert.equal($('ruler-reading').textContent,'Distance: 60.00 mm');
 moveEnd('body',720,560);assert.equal($('ruler-reading').textContent,'Distance: 60.00 mm');
 $('reset').onclick();assert.equal($('show-ruler').attrs['aria-pressed'],'false');assert(!$('board').innerHTML.includes('class="ruler-overlay"'));
});
check('Bench tool buttons toggle independently and protractor works while Inspect locks optics',()=>{
 $('reset').onclick();assert.equal($('show-protractor').attrs['aria-pressed'],'false');$('show-protractor').onclick();assert($('board').innerHTML.includes('class="protractor-overlay"'));assert(!$('protractor-help').hidden);
 $('show-ruler').onclick();assert($('board').innerHTML.includes('class="ruler-overlay"'));$('show-ruler').onclick();assert($('board').innerHTML.includes('class="protractor-overlay"'));
 $('inspect').onclick();const source=sourcePose();
 function toolDrag(part,x,y,toX,toY){$('board').handlers.pointerdown({target:{closest:s=>s==='[data-protractor]'?{dataset:{protractor:part}}:null},clientX:x,clientY:y,pointerId:10});$('board').handlers.pointermove({clientX:toX,clientY:toY});$('board').handlers.pointerup();}
 toolDrag('move',250,220,400,300);assert($('board').innerHTML.includes('translate(400 300) rotate(0)'));
 toolDrag('measure',480,220,400,182);assert($('board').innerHTML.includes('90.0°'));
 toolDrag('rotate',549,300,400,449);assert($('board').innerHTML.includes('translate(400 300) rotate(90)'));assert.deepEqual(sourcePose(),source);
 $('show-protractor').onclick();assert(!$('board').innerHTML.includes('class="protractor-overlay"'));$('show-protractor').onclick();assert($('board').innerHTML.includes('translate(400 300) rotate(90)'));
 $('reset').onclick();assert.equal($('show-protractor').attrs['aria-pressed'],'false');
});
check('Inspect can hide all ray angles and normals while keeping checkboxes authoritative',()=>{
 $('reset').onclick();assert($('hide-all-angles').hidden);$('inspect').onclick();$('show-all-angles').onclick();$('hide-all-angles').onclick();
 assert.equal($('hide-all-angles').attrs['aria-pressed'],'true');assert(!$('board').innerHTML.includes('class="normal"'));assert(!$('board').innerHTML.includes('i 50.0°'));
 assert($('readout').innerHTML.includes('50.0°'));
 $('board').handlers.pointerdown({target:{closest:s=>s==='[data-hit]'?{dataset:{ray:'0',hit:'1'}}:null}});assert(!$('board').innerHTML.includes('class="normal"'));
 $('show-all-angles').onclick();assert.equal(($('board').innerHTML.match(/class="normal"/g)||[]).length,2);
 $('hide-all-angles').onclick();$('edit').onclick();assert($('hide-all-angles').hidden);assert(!$('board').innerHTML.includes('class="normal"'));assert(!$('normal').checked&&!$('angles').checked);
 $('reset').onclick();
});
check('Hide-all unchecks controls and each annotation can be restored independently',()=>{
 $('reset').onclick();$('inspect').onclick();$('showDeviation').checked=true;$('showDeviation').onchange({target:$('showDeviation')});$('hide-all-angles').onclick();
 assert(!$('normal').checked&&!$('angles').checked&&!$('showDeviation').checked);
 $('normal').checked=true;$('normal').onchange({target:$('normal')});assert($('board').innerHTML.includes('class="normal"'));assert(!$('board').innerHTML.includes('i 50.0°'));assert.equal($('hide-all-angles').attrs['aria-pressed'],'false');
 $('normal').checked=false;$('normal').onchange({target:$('normal')});$('angles').checked=true;$('angles').onchange({target:$('angles')});assert(!$('board').innerHTML.includes('class="normal"'));assert($('board').innerHTML.includes('i 50.0°'));
 $('show-all-angles').onclick();assert($('normal').checked&&$('angles').checked);$('reset').onclick();
});
check('Billiards hides the path, shoots on cue release, reveals the result and leaves other modes unchanged',()=>{
 $('reset').onclick();assert($('billiards-section').hidden);assert(!$('board').innerHTML.includes('data-item="hole"'));
 $('billiards').onclick();
 assert.equal($('billiards').attrs['aria-pressed'],'true');assert.equal($('edit').attrs['aria-pressed'],'false');
 assert(!$('billiards-section').hidden);for(const id of ['source-panel','toolbox-section','properties-section','media-section','try-section'])assert($(id).hidden);
 let html=$('board').innerHTML;assert(html.includes('data-item="hole"'));assert(html.includes('data-item="cue"'));assert(html.includes('class="ball"'));assert(!html.includes('data-item="source"'));
 assert.equal((html.match(/class="ray"/g)||[]).length,2,'only the incident leg is drawn before the shot');
 assert.equal((html.match(/class="normal"/g)||[]).length,1);assert(html.includes('i 50.0°'));assert(!html.includes('r 50.0°'));
 assert(!$('readout').innerHTML.includes('Total internal reflection'));assert($('readout').innerHTML.includes('50.0°'));
 assert($('billiards-status').textContent.includes('reachable'));assert.equal($('shoot').disabled,false);assert.equal($('retry').disabled,true);
 assert($('speed-caption').textContent.includes('67 %'));
 // Aim with the handle, then pull the cue back and release: pull distance is irrelevant.
 $('board').handlers.pointerdown({target:{closest:s=>s==='[data-rotate]'?{dataset:{rotate:'source'}}:null},clientX:520,clientY:266,pointerId:11});
 $('board').handlers.pointermove({clientX:520,clientY:250});$('board').handlers.pointerup();
 assert(Math.abs($('aim').value-(-45))<.5,'handle drag re-aims the ball');
 change('aim',-40);assert.equal($('aim').value,-40);assert($('readout').innerHTML.includes('50.0°'));
 $('board').handlers.pointerdown({target:{closest:s=>s==='[data-item]'?{dataset:{item:'cue'}}:null},clientX:300,clientY:450,pointerId:12});
 $('board').handlers.pointermove({clientX:260,clientY:484});assert($('billiards-status').textContent.includes('Release'));assert($('board').innerHTML.includes('data-item="cue"'));
 $('board').handlers.pointerup();
 assert($('billiards-status').textContent.includes('flight'));assert.equal($('shoot').disabled,true);assert.equal(frames.length,1);
 let t=0;frames.shift()(0);frames.shift()(400);html=$('board').innerHTML;t=800;
 assert(html.includes('class="ball"')&&!html.includes('data-item="cue"'),'ball in flight without the cue');
 const ball=html.match(/<g class="ball"[^>]*><circle cx="([^"]+)" cy="([^"]+)"/);assert(Math.hypot(+ball[1]-420,+ball[2]-350)>50,'ball has left the source');
 assert(($('board').innerHTML.match(/class="ray"/g)||[]).length>=2,'trail follows the ball');
 while(frames.length){frames.shift()(t);t+=400;}
 assert(/Sunk|Missed/.test($('billiards-status').textContent));html=$('board').innerHTML;
 assert(($('board').innerHTML.match(/class="ray"/g)||[]).length>=4,'path revealed after the shot');assert(html.includes('r 50.0°'));
 assert($('readout').innerHTML.includes('Total internal reflection'));assert($('billiards-score').innerHTML.includes('<strong>1</strong>'));
 assert.equal($('retry').disabled,false);assert.equal($('shoot').disabled,true);
 $('retry').onclick();assert.equal($('shoot').disabled,false);assert.equal((($('board').innerHTML.match(/class="ray"/g)||[]).length),2);assert($('billiards-score').innerHTML.includes('<strong>1</strong>'));
 $('shoot').onclick();while(frames.length){frames.shift()(t);t+=400;}assert($('billiards-score').innerHTML.includes('<strong>2</strong>'));
 assert(/<strong>[01] \/ 1<\/strong>/.test($('billiards-score').innerHTML),'a target is sunk at most once');
 $('new-target').onclick();assert($('billiards-score').innerHTML.includes('<strong>0</strong>'));assert($('billiards-score').innerHTML.includes('/ 2'));
 // Dragging the hole onto the block is refused; a valid drop rescans for a solution.
 const hole=$('board').innerHTML.match(/<g data-item="hole"[^>]*><circle cx="([^"]+)" cy="([^"]+)"/),hx=+hole[1],hy=+hole[2];
 $('board').handlers.pointerdown({target:{closest:s=>s==='[data-item]'?{dataset:{item:'hole'}}:null},clientX:hx,clientY:hy,pointerId:13});
 $('board').handlers.pointermove({clientX:500,clientY:325});$('board').handlers.pointerup();
 assert($('board').innerHTML.includes(`<g data-item="hole" class="hole movable"><circle cx="${hx}" cy="${hy}"`));
 $('board').handlers.pointerdown({target:{closest:s=>s==='[data-item]'?{dataset:{item:'hole'}}:null},clientX:hx,clientY:hy,pointerId:14});
 $('board').handlers.pointermove({clientX:hx+(hx>500?-40:40),clientY:hy});$('board').handlers.pointerup();
 assert(!$('board').innerHTML.includes(`<circle cx="${hx}" cy="${hy}" r="30"`));assert(/solution|No aim/.test($('billiards-status').textContent));
 $('inspect').onclick();assert($('billiards-section').hidden);assert(!$('inspect-help').hidden);assert($('board').innerHTML.includes('data-item="source"'));assert(!$('board').innerHTML.includes('data-item="hole"'));
 $('billiards').onclick();assert($('board').innerHTML.includes('data-item="hole"'));$('edit').onclick();assert(!$('source-panel').hidden);assert(!$('board').innerHTML.includes('data-item="cue"'));
 $('reset').onclick();assert.equal($('board').innerHTML,initial);assert($('billiards-section').hidden);
});
check('Separate controls target their own object regardless of bench selection',()=>{
 $('reset').onclick();$('select-block').onclick();
 change('source-orientation',-60);assert(Math.abs(sourcePose().angle+60)<1e-6);assert.equal($('block-orientation').value,0);
 $('select-source').onclick();change('block-orientation',15);
 assert(Math.abs(sourcePose().angle+60)<1e-6);assert.equal($('block-orientation').value,15);
 assert(!$('source-panel').hidden&&!$('properties-section').hidden&&!$('source-properties').hidden);
 change('shape-preset','semicircle');$('select-source').onclick();assert(!$('radius-control').hidden);
 $('reset').onclick();
 const html=fs.readFileSync(root+'index.html','utf8'),ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(ids.length,new Set(ids).size);
 for(const id of elements.keys())assert(ids.includes(id),'Missing HTML control: '+id);
});
console.log(checks+' control checks passed (DOM fixture, not browser rendering).');
