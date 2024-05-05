const maybe = function(val,def){
    return val ? val : def;
};

const applyStyle = function (elem, style) {
    for (let key in style) {
        elem.style[key] = style[key];
    }
    return elem;
};

const applyAttrs = function (elem, attrs) {
    for (let key in attrs) {
        elem.setAttribute(key, attrs[key]);
    }
    return elem;
};

const elem = function ({
  query,
  tag = "div",
  attrs = {},
  style = {},
  children = [],
  child,
  click = () => {},
  load = () => {},
  on = {},
  id,
  inner,
}) {
  let element = query
    ? document.querySelector(query)
    : document.createElement(tag);
  if (id) element.id = id;
  if (child) children.push(child);
  applyStyle(element, style);
  applyAttrs(element, attrs);
  if (inner) {
    element.innerHTML = inner;
  } else {
    for (let child of children) {
      if (typeof child === "string") {
        element.appendChild(document.createTextNode(child));
      } else {
        element.appendChild(elem(child));
      }
    }
  }
  element.onclick = click;
  for(let evt in on){
      element.addEventListener(evt,on[evt]);
  }
  // defer
  setTimeout(() => load(element), 0);
  return element;
};

const addChild = function(e,args){
    const child = elem(args);
    e.appendChild(child);
    return child;
};

const once = function(target,evt,stopPropagation){
    return new Promise(res=>{
        let cb;
        target.addEventListener(evt,cb=(e)=>{
            target.removeEventListener(evt,cb);
            if(stopPropagation)e.stopPropagation();
            res(e);
        });
    });
};

const checkboxField = function(features){
    const wrapper = elem({tag:"div"});
    for(let key in features){
        if(typeof features[key] === "boolean"){
            let row = elem({
                tag: "div",
                inner: `${key}: <input type="checkbox">`
            });
            let input = row.querySelector("input");
            input.checked = features[key];
            input.addEventListener("click",()=>{
                features[key] = input.checked;
            });
            wrapper.appendChild(row);
        }else if(typeof features[key] === "number"){
            let row = elem({
                tag: "div",
                inner: `${key}: <input type="text">`
            });
            let input = row.querySelector("input");
            input.value = features[key];
            input.addEventListener("input",()=>{
                features[key] = parseInt(input.value);
            });
            wrapper.appendChild(row);
        }else if(features[key] instanceof Array && features[key].every(v=>typeof v === "string")){
            const options = features[key];
            features[key] = options[0];
            let first = true;
            for(let val of options){
                let row = elem({
                    tag: "div",
                    inner: `${val}: <input type="radio" name="${key}">`
                });
                let input = row.querySelector("input");
                if(first && !(first=false))
                    input.checked = true;
                input.addEventListener("click",()=>{
                    features[key] = val;
                });
                wrapper.appendChild(row);
            }
        }
    }
    return wrapper;
};

const flexSpacing = {
    display: "flex",
    justifyContent: "space-between",
};

const closable = function(child,label){
    const e = elem({
        tag: "div",
    });
    let head = addChild(e,{
        tag: "div",
        style: flexSpacing,
        inner: `<span>${label}</span>`
    });
    let closed = false;
    let closeBtn = addChild(head,{
        tag: "div",
        inner: "V"
    });
    applyStyle(child,{
        transition: "max-height 0.2s ease-out",
        overflow: "hidden",
        maxHeight: "0px",
    });
    e.appendChild(child);
    head.addEventListener("click",()=>{
        closed = !closed;
        if(closed){
            closeBtn.innerHTML = "^";
            child.style.maxHeight = child.scrollHeight + "px";
        }else{
            closeBtn.innerHTML = "V";
            child.style.maxHeight = "0px";
        }
    });
    console.log(e,child);
    return e;
};

const movableWindow = function(child,label){
    const e = elem({
        tag: "div",
        style: {
            transition: "max-height max-width 0.2s ease-out",
            overflow: "hidden",
            maxHeight: "1000px",
            maxWidth: "300px",
            position: "absolute",
            zIndex: "100",
            border: "solid 1px #000"
        }
    });
    let head = addChild(e,{
        tag: "div",
        style: flexSpacing,
        inner: `<span>${label}</span>`
    });
    let closeBtn = addChild(head,{
        tag: "div",
        inner: "X"
    });
    e.appendChild(child);
    (async ()=>{
        let cb;
        while(true){
            const evt0 = await once(head,"mousedown");
            const offsetX = evt0.pageX - e.offsetLeft;
            const offsetY = evt0.pageY - e.offsetTop;
            window.addEventListener("mousemove",cb=(evt)=>{
                applyStyle(e,{
                    top: (evt.clientY - offsetY) + "px",
                    left: (evt.clientX - offsetX) + "px",
                });
            });
            await once(window,"mouseup");
            window.removeEventListener("mousemove",cb);
        }
    })();

    (async ()=>{
        while(true){
            await once(closeBtn,"click",true);
            e.style.maxHeight = "20px";
            e.style.maxWidth = "20px";
            console.log("height",e.style.maxHeight,e.style.maxWidth)
            await once(e,"click",true);
            console.log("reversed");
            e.style.maxHeight = e.scrollHeight + "px";
            e.style.maxWidth = "300px";
        }
    })();
    return e;
}

const features = {
    alignment: true,
    alignmentRadius: 40,
    cohesion: true,
    cohesionRadius: 400,
    repel: true,
    repelRadius: 30,
    noise: true,
    wallDetectionRange: 50,
    evadeWall: true,
}

const palette = {
    palette: ["boid","wall"]
}
window.features = features;
window.palette = palette;

const controlWrapper = elem({tag: "div"});
controlWrapper.appendChild(closable(checkboxField(features),"Features"));
controlWrapper.appendChild(closable(checkboxField(palette), "Palette"));

document.body.appendChild(movableWindow(controlWrapper,"Boid V 0.0.0"));

const canvas = elem({
    tag: "canvas",
});

let width, height;

const updateWindowSize = function(w,h){
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
}
updateWindowSize();

window.addEventListener('resize', updateWindowSize);

document.body.appendChild(canvas);


//render loop

const boids = new Set;
const walls = new Set;

const getDist = function(a,b){
    return Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2);
};

const isUnusual = function(n){
    return isNaN(n) || n === Infinity || n === -Infinity;
};

const getRandomNormal = function(){
    const x = Math.random() - 0.5;
    const y = Math.random() - 0.5;
    return normalize(x,y);
};

const normalize = function(x,y){
    let r = Math.sqrt(x**2+y**2)
    x /= r;
    y /= r;
    if(isUnusual(x) || isUnusual(y))return getRandomNormal();
    return [x,y];
};

class Boid{
    static fromXY(x,y){
        const boid = new Boid;
        boid.x = x;
        boid.y = y;
        boid.heading = Math.random()*Math.PI*2;
        boid.randomizeDirection();
        return boid;
    }
    normalize(){
        let [vx,vy] = normalize(this.vx,this.vy);
        this.vx = vx;
        this.vy = vy;
        this.x = (this.x + width)%width;
        this.y = (this.y + height)%height;
    }
    randomizeDirection(){
        let [vx,vy] = getRandomNormal();
        this.vx = vx;
        this.vy = vy;
    }
    diffxy(target){
        let dx = (target.x + width * 1.5 - this.x)%width - width/2;
        let dy = (target.y + height * 1.5 - this.y)%height - height/2;
        return [dx,dy];
    }
    calculateHeading(boids){
        let alx = 0;
        let aly = 0;
        let chx = 0;
        let chy = 0;
        let rpx = 0;
        let rpy = 0;
        let alignmentMode = false;
        let repelMode = false;
        let cohesionMode = false;
        for(let boid of boids){
            if(boid === this)continue;
            const dist = getDist(boid,this);
            if(features.alignment && dist < features.alignmentRadius){
                alignmentMode = true;
                alx += boid.vx;
                aly += boid.vy;
            }
            if(features.cohesion && dist < features.cohesionRadius){
                cohesionMode = true;
                const [dx,dy] = this.diffxy(boid);
                if(features.repel && dist < features.repelRadius){
                    repelMode = true;
                    rpx += dx;
                    rpy += dy;
                }else{
                    chx += dx;
                    chy += dy;
                }
            }
        }
        let wlx = 0;
        let wly = 0;
        let wallEvadeMode = false;
        for(let wall of walls){
            const dist = getDist(wall,this);
            if(features.evadeWall && dist < features.wallDetectionRange){
                wallEvadeMode = true;
                const [dx,dy] = this.diffxy(wall);
                //console.log(dx,dy,dist);
                //throw new Error("asdf");
                wlx += dx;
                wly += dy;
            }
        }
        let hx = this.vx;
        let hy = this.vy;
        if(alignmentMode){
            [alx,aly] = normalize(alx,aly);
            hx += alx;
            hy += aly;
        }
        if(repelMode){
            [rpx,rpy] = normalize(rpx,rpy);
            hx -= rpx;
            hy -= rpy;
        }else if(cohesionMode){
            [chx,chy] = normalize(chx,chy);
            hx += rpx/1;
            hy += rpy/1;
        }
        if(wallEvadeMode){
            [wlx,wly] = normalize(wlx,wly);
            hx -= wlx;
            hy -= wly;
        }
        if(features.noise){
            hx += (Math.random()-0.5)*0.7;
            hy += (Math.random()-0.5)*0.7;
        }

        [hx,hy] = normalize(hx,hy);

        this.vx1 = hx;
        this.vy1 = hy;
    }
    update(){
        this.vx = this.vx1;
        this.vy = this.vy1;
        this.x += this.vx;
        this.y += this.vy;
        this.normalize();
    }
}

canvas.addEventListener("click",(e)=>{
    const {x,y} = e;
    if(palette.palette === "boid"){
        boids.add(Boid.fromXY(x,y));
    }else{
        walls.add({x,y});
    }
});


const ctx = canvas.getContext("2d");

const render = function(){
    ctx.clearRect(0,0,width,height);
    for(let boid of boids){
        const {x,y} = boid;
        ctx.beginPath();
        ctx.arc(x,y,2,0,Math.PI*2);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x,y);
        ctx.lineTo(x+5*boid.vx,y+5*boid.vy);
        ctx.stroke();
    }
    for(let wall of walls){
        const {x,y} = wall;
        ctx.beginPath();
        ctx.arc(x,y,4,0,Math.PI*2);
        ctx.closePath();
        ctx.stroke();
    }
}

const animate = function(){
    for(let boid of boids){
        boid.calculateHeading(boids);
    }
    for(let boid of boids){
        boid.update();
    }
    render();
    requestAnimationFrame(animate);
}
requestAnimationFrame(animate);




