// D-shaped optical proxy. The original runtime used three rounded cylinders
// for its six-armed balloon. This seven-stroke proxy follows the new monogram.
// It preserves the same AO / soft-shadow / reflection-distance return contract.
// This is a conservative analytic approximation, not a mesh ray tracer.
float dailySphereHit(vec3 ro,vec3 rd,vec3 center,float radius){
  vec3 oc=ro-center;float b=dot(oc,rd),h=b*b-dot(oc,oc)+radius*radius;
  if(h<0.)return 200.;float t=-b-sqrt(h);return t>0.0001?t:200.;
}
vec3 dailyStroke(vec3 p,vec3 n,vec3 l,vec3 refl,vec3 a,vec3 b,float r,bool trace){
  vec3 ba=b-a,oa=p-a;float baba=dot(ba,ba),oaba=dot(oa,ba);
  vec3 od=oa-ba*clamp(oaba/baba,0.,1.);float dl=max(length(od),.001);
  float ao=1.-clamp(dot(-od,n)*r*r/(dl*dl*dl),0.,1.);ao=sqrt(ao*ao*ao);
  float oad=dot(oa,l),dba=dot(l,ba),den=max(baba-dba*dba,.00001);
  float th=max((-oad*baba+dba*oaba)/den,.0001),along=clamp((oaba-oad*dba)/den,0.,1.);
  float dd=length(a+ba*along-(p+l*th))-r;
  float shadow=clamp(dd/th+.5,0.,1.);shadow=shadow*shadow*(3.-2.*shadow);
  float hit=200.;
  if(trace){hit=min(cylIntersect(p,refl,a,b,r),min(dailySphereHit(p,refl,a,r),dailySphereHit(p,refl,b,r)));}
  return vec3(ao,shadow,hit);
}
vec3 getCrossAoShadowIntersect(in vec3 p,in vec3 n,in vec3 l,in vec3 refl,in vec4 objPosRadius,in vec4 quaternion,in float intersectDist){
  vec4 inverseQ=vec4(-quaternion.xyz,quaternion.w);float scale=objPosRadius.w;
  vec3 local=qrotate(p-objPosRadius.xyz,inverseQ)/scale;
  if(length(local)>9.)return vec3(1.,1.,100.);
  vec3 metric=vec3(1.,1.,.16);
  vec3 ro=local*metric;
  vec3 normal=normalize(qrotate(n,inverseQ)/metric);
  vec3 light=normalize(qrotate(l,inverseQ)*metric);
  vec3 reflection=qrotate(refl,inverseQ)*metric;float reflectionScale=length(reflection);reflection/=reflectionScale;
  bool trace=centerSphereHitTest(local,qrotate(refl,inverseQ),1.8)&&(intersectDist+3.6*scale>length(local)*scale);
  vec3 result=vec3(1.,1.,200.),stroke;
  stroke=dailyStroke(ro,normal,light,reflection,vec3(-.64,-.83,0.),vec3(-.11,.82,0.),.115,trace);result.xy*=stroke.xy;result.z=min(result.z,stroke.z);
  stroke=dailyStroke(ro,normal,light,reflection,vec3(-.31,.87,0.),vec3(.34,.84,0.),.062,trace);result.xy*=stroke.xy;result.z=min(result.z,stroke.z);
  stroke=dailyStroke(ro,normal,light,reflection,vec3(.33,.80,0.),vec3(.68,.51,0.),.13,trace);result.xy*=stroke.xy;result.z=min(result.z,stroke.z);
  stroke=dailyStroke(ro,normal,light,reflection,vec3(.68,.51,0.),vec3(.70,-.02,0.),.18,trace);result.xy*=stroke.xy;result.z=min(result.z,stroke.z);
  stroke=dailyStroke(ro,normal,light,reflection,vec3(.70,-.02,0.),vec3(.47,-.54,0.),.17,trace);result.xy*=stroke.xy;result.z=min(result.z,stroke.z);
  stroke=dailyStroke(ro,normal,light,reflection,vec3(.47,-.54,0.),vec3(.02,-.83,0.),.10,trace);result.xy*=stroke.xy;result.z=min(result.z,stroke.z);
  stroke=dailyStroke(ro,normal,light,reflection,vec3(-.78,-.88,0.),vec3(.03,-.88,0.),.054,trace);result.xy*=stroke.xy;result.z=min(result.z,stroke.z);
  result.z=result.z<199.?result.z*scale/reflectionScale:100.;
  return result;
}
