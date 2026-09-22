import { useEffect, useRef } from 'react'

/* ═══════════════════════════════════════════════════════════
   كرة المساعد · بديل تجريبي لشرارة الذكاء الاصطناعي

   زجاج كروي بيعكس ويكسر ضوءًا متحرّكًا · مرسوم في WebGL بشيدر
   واحد، بألوان الهوية (`#144547` و`#00A59B` و`#94D603`) لا
   بألوان جاهزة.

   ⚠️ **تجربة في شاشة واحدة أولًا (اليوم)** · قبل توزيعها على
   السيستم كله، عشان نشوف شكلها وحِملها في مكانها الطبيعي.

   ⚠️ **بتقف لمّا تخرج من الشاشة أو التبويب يتخفّى**، وما
   بتشتغلش أصلًا مع `prefers-reduced-motion` · الرسم المستمر
   على بطارية جهاز المستخدم مش مجاني.

   ⚠️ **ولو WebGL مش متاح، الحلقة بتفضل ملوّنة بتدرّج** بدل
   مربع فاضي.
   ═══════════════════════════════════════════════════════════ */

const FRAG = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform float uEnergy;
const float TAU=6.28318, IOR=1.45;
const vec3 C_DEEP=vec3(.078,.271,.278);
const vec3 C_TEAL=vec3(.0,.647,.608);
const vec3 C_LIME=vec3(.580,.839,.012);
const vec3 C_GLOW=vec3(.06,.80,.80);
const vec3 C_HOT =vec3(.60,1.,.94);
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
vec3 h33(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.xxy+p.yxx)*p.zyx);}
float pn(vec2 p,float P){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float i0=mod(i.x,P),i1=mod(i.x+1.,P);
  return mix(mix(h21(vec2(i0,i.y)),h21(vec2(i1,i.y)),f.x),mix(h21(vec2(i0,i.y+1.)),h21(vec2(i1,i.y+1.)),f.x),f.y);}
float pfbm(vec2 p,float P){float s=0.,a=.5;for(int i=0;i<3;i++){s+=a*pn(p,P);p*=2.;P*=2.;a*=.5;}return s;}
vec2 sph(vec3 ro,vec3 rd){float b=dot(ro,rd),c=dot(ro,ro)-1.,h=b*b-c;if(h<0.)return vec2(-1.);h=sqrt(h);return vec2(-b-h,-b+h);}
float T;
float RG;
float n3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  float a=h21(i.xy+i.z*17.),b=h21(i.xy+vec2(1,0)+i.z*17.),c=h21(i.xy+vec2(0,1)+i.z*17.),d=h21(i.xy+1.+i.z*17.);
  float e=h21(i.xy+(i.z+1.)*17.),g=h21(i.xy+vec2(1,0)+(i.z+1.)*17.),h=h21(i.xy+vec2(0,1)+(i.z+1.)*17.),k=h21(i.xy+1.+(i.z+1.)*17.);
  return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y),mix(mix(e,g,f.x),mix(h,k,f.x),f.y),f.z);}
mat3 rot;
vec3 env(vec3 d){
  float lon=atan(d.y,d.x)/TAU+.5;
  vec3 c=mix(C_DEEP*.12,C_DEEP*.5,smoothstep(-1.,1.,d.y));
  float wv=pn(vec2(lon*5.,d.z*3.-T*.4),5.)*.06;
  float pan=pfbm(vec2((lon+wv)*8.+T*.05,d.z*2.5-T*.25),8.);
  c+=mix(C_DEEP,C_TEAL,.6)*pow(smoothstep(.4,.85,pan),2.5)*2.2;
  float ln=pn(vec2((lon+wv)*32.+T*.1,d.z*4.-T*.6),32.)*pow(pn(vec2(lon*32.,d.z*16.-T*2.),32.),3.)*2.2;
  float ln2=pn(vec2((lon+wv)*64.-T*.07,d.z*6.+T*.5),64.)*pow(pn(vec2(lon*64.,d.z*24.-T*2.5),64.),2.);
  c+=mix(C_TEAL,C_LIME,.25)*pow(ln2,mix(5.,2.,RG))*1.3*mix(1.,.35,RG);
  c+=C_TEAL*pow(min(ln,1.),mix(10.,3.,RG))*1.2*mix(1.,.35,RG)*(.3+.7*pn(vec2(lon*6.,T*.3),6.));
  vec3 dl=rot*d;
  for(int i=0;i<10;i++){
    float fi=float(i);
    float y=1.-(fi+.5)/5.; float rr=sqrt(max(1.-y*y,0.)); float ph=fi*2.39996;
    vec3 L=vec3(cos(ph)*rr,y,sin(ph)*rr);
    float k=110.+mod(fi*53.,220.);
    float I=(3.5+2.*sin(T*.9+fi*1.7));
    c+=mix(C_TEAL,mix(C_GLOW,C_LIME,step(.78,fract(fi*.37))),fract(fi*.37))*pow(max(dot(dl,L),0.),k*mix(1.,.3,RG))*I*mix(1.,.12,RG);
  }
  c+=C_HOT*pow(max(dot(d,normalize(vec3(.55,.65,.5))),0.),90.)*1.6;
  for(int k=0;k<3;k++){
    float fk=float(k); vec3 g=dl*(5.+fk*4.)+fk*7.; vec3 id=floor(g), f=fract(g)-.5;
    vec3 j=h33(id+fk*13.); vec3 dv=f-(j-.5)*.3;
    float on=step(.35,j.z);
    float tw=.6+.4*sin(T*(1.5+j.x*3.)+j.y*30.);
    c+=mix(C_TEAL,mix(C_GLOW,C_LIME,step(.8,j.y)),j.x)*exp(-dot(dv,dv)*(90.+fk*80.)*mix(1.,.3,RG))*on*tw*(3.8-fk)*mix(1.,.28,RG);
  }
  return c;
}
float segD(vec3 o,vec3 d,vec3 a,vec3 b){vec3 ba=b-a,oa=o-a;float dba=dot(d,ba),baba=dot(ba,ba);
  float th=clamp((dot(oa,ba)-dot(oa,d)*dba)/max(baba-dba*dba,1e-5),0.,1.);return length(cross(a+ba*th-o,d));}
vec3 inner(vec3 o,vec3 d){
  vec3 acc=vec3(0.);
  float b2=dot(cross(o,d),cross(o,d));
  acc+=C_GLOW*(exp(-b2*22.)*.9+exp(-b2*5.)*.2)*(.8+.5*uEnergy);
  for(int i=0;i<40;i++){
    float fi=float(i); vec3 h=h33(vec3(fi*2.1,fi*.37,9.9));
    vec3 hh=h33(vec3(fi,1.3,fi*.9)); float cz=hh.x*2.-1., cp=hh.y*TAU;
    vec3 c=vec3(sqrt(1.-cz*cz)*vec2(cos(cp),sin(cp)),cz)*.26*pow(hh.z,.7)+.03*vec3(sin(T*1.3+fi),cos(T*1.1+fi*2.),sin(T*.9+fi*3.));
    float dd=length(cross(c-o,d));
    float tw=.45+.55*pow(.5+.5*sin(T*(2.+h.x*5.)+fi*7.),3.);
    float w=(.006+.01*h.y)*(1.+RG*1.5);
    acc+=mix(C_HOT,C_LIME,step(.78,h.z))*(exp(-dd*dd/(w*w))*2./(1.+RG*1.5)+exp(-dd*dd/(w*w*14.))*.22)*tw;
  }
  for(int i=0;i<8;i++){
    float fi=float(i); vec3 h=fract(sin(vec3(fi*12.99+1.1,fi*78.23+5.3,fi*37.71+9.7))*43758.5);
    float cz=h.x*2.-1., ph=h.y*TAU; vec3 dir=vec3(sqrt(1.-cz*cz)*vec2(cos(ph),sin(ph)),cz);
    float life=fract(T*(.12+.1*h.z)+h.z*7.);
    float rad=mix(.12,.85,life);
    vec3 hd=dir*rad, tl=dir*rad*(1.-.06-.06*h.x);
    float w=.028*(.5+rad);
    float dd=segD(o,d,tl,hd);
    acc+=mix(C_GLOW,C_LIME,step(.78,h.y))*exp(-dd*dd/(w*w))*sin(3.1416*life)*(.4+h.x)*.9;
  }
  return acc;
}
void main(){
  vec2 uv=(gl_FragCoord.xy*2.-uRes)/min(uRes.x,uRes.y);
  T=uTime*(.38+.45*uEnergy);
  float ay=T*.55, ax=T*.31;
  rot=mat3(cos(ay),0.,-sin(ay),0.,1.,0.,sin(ay),0.,cos(ay))*mat3(1.,0.,0.,0.,cos(ax),sin(ax),0.,-sin(ax),cos(ax));
  vec3 ro=vec3(0.,0.,3.2), rd=normalize(vec3(uv,-2.55));
  vec2 o=sph(ro,rd);
  float dmin=length(cross(ro,rd))-1.;
  vec3 halo=C_TEAL*exp(-max(dmin,0.)*16.)*(.16+.14*uEnergy)*(1.-smoothstep(.12,.2,dmin));
  if(o.x<0.){gl_FragColor=vec4(halo,0.);return;}
  vec3 p1=ro+rd*o.x, n1=normalize(p1);
  vec3 fp=n1*1.6+vec3(T*.08,-T*.055,T*.04);
  RG=smoothstep(.34,.68,n3(fp)*.65+n3(fp*2.3+5.)*.35);
  vec3 bump=vec3(n3(fp*3.+1.),n3(fp*3.+7.),n3(fp*3.+13.))-.5;
  n1=normalize(n1+bump*RG*.16);
  float ci=clamp(dot(-rd,n1),0.,1.);
  float F=.04+.96*pow(1.-ci,5.);
  vec3 col=env(reflect(rd,n1))*F*1.4;
  vec3 r2=refract(rd,n1,1./IOR);
  float tx=sph(p1,r2).y; vec3 p3=p1+r2*tx, n3v=normalize(p3);
  vec3 r3=refract(r2,-n3v,IOR); if(dot(r3,r3)<.01) r3=reflect(r2,-n3v);
  vec3 tint=exp(-vec3(.85,.10,.30)*tx);
  vec3 thru=env(r3)*1.25;
  vec3 ir=env(reflect(r2,-n3v))*.35*(.3+pow(1.-clamp(dot(r2,n3v),0.,1.),2.));
  col+=(1.-F)*tint*(thru+ir)+inner(p1,r2)*tint;
  col+=mix(C_TEAL,C_GLOW,.4)*(pow(1.-ci,4.)*1.4+pow(1.-ci,2.)*.12);
  vec3 rf=rot*reflect(rd,n1);
  for(int i=0;i<3;i++){float fi=float(i);float ph=fi*2.1+.4;vec3 L=normalize(vec3(cos(ph),.5-fi*.4,sin(ph)));
    col+=C_HOT*(pow(max(dot(rf,L),0.),260.)*3.+pow(max(dot(rf,L),0.),30.)*.35);}
  vec3 aces=col*(2.51*col+.03)/(col*(2.43*col+.59)+.14);
  float lum=dot(col,vec3(.22,.62,.16));
  float lt=lum*(2.51*lum+.03)/(lum*(2.43*lum+.59)+.14);
  col*=lt/max(lum,1e-4);
  col=col+max(col.g-1.,0.)*vec3(.55,0.,.45);
  col=mix(aces,min(col,1.),.35);
  float aa=1.-smoothstep(-.004,0.,-(o.y-o.x)+.004);
  gl_FragColor=vec4(col+halo*(1.-aa),aa);
}`

const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}'

/** طاقة الحركة لكل حالة · الهدوء أبطأ، والتفكير أسرع */
const ENERGY = { idle: 0.15, thinking: 1, listening: 0.55 } as const

export type OrbState = keyof typeof ENERGY

export interface AiOrbProps {
  state?: OrbState
  className?: string
}

export function AiOrb({ state = 'idle', className }: AiOrbProps) {
  const box = useRef<HTMLSpanElement>(null)
  const cv = useRef<HTMLCanvasElement>(null)
  const target = useRef(ENERGY[state])

  useEffect(() => { target.current = ENERGY[state] }, [state])

  useEffect(() => {
    const host = box.current
    const canvas = cv.current
    if (!host || !canvas) return

    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false })
    if (!gl) { host.classList.add('noGl'); return }

    const sh = (t: number, s: string) => {
      const o = gl.createShader(t)!
      gl.shaderSource(o, s); gl.compileShader(o)
      return o
    }
    const pr = gl.createProgram()!
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT))
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(pr); gl.useProgram(pr)
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    const uRes = gl.getUniformLocation(pr, 'uRes')
    const uTime = gl.getUniformLocation(pr, 'uTime')
    const uEnergy = gl.getUniformLocation(pr, 'uEnergy')

    let energy = target.current
    let time = Math.random() * 50
    let raf = 0
    let last = 0
    let seen = true

    const draw = () => {
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uTime, time)
      gl.uniform1f(uEnergy, energy)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    const size = () => {
      const d = Math.min(window.devicePixelRatio || 1, 1.5)
      const px = Math.max(16, Math.min(Math.round(host.clientWidth * d), 640))
      canvas.width = px; canvas.height = px
      gl.viewport(0, 0, px, px)
      draw()
    }

    const calm = window.matchMedia('(prefers-reduced-motion: reduce)')
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      energy += (target.current - energy) * Math.min(dt * 3, 1)
      time += dt
      draw()
      raf = requestAnimationFrame(loop)
    }
    const kick = () => {
      const run = seen && !document.hidden && !calm.matches
      if (run && !raf) { last = performance.now(); raf = requestAnimationFrame(loop) }
      if (!run && raf) { cancelAnimationFrame(raf); raf = 0; draw() }
    }

    const ro = new ResizeObserver(size)
    ro.observe(host)
    const io = new IntersectionObserver(([e]) => { seen = e.isIntersecting; kick() })
    io.observe(host)
    document.addEventListener('visibilitychange', kick)
    calm.addEventListener('change', kick)

    size(); kick()
    return () => {
      ro.disconnect(); io.disconnect()
      document.removeEventListener('visibilitychange', kick)
      calm.removeEventListener('change', kick)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <span ref={box} className={`aiorb${className ? ` ${className}` : ''}`} aria-hidden="true">
      <canvas ref={cv} />
    </span>
  )
}
