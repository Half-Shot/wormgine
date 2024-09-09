precision mediump float;
uniform vec4 uStartColor;

void main() {
    vec4 endColor = vec4(0.0, 0.0, 0.0, 1.0);
    
    vec2 uv = gl_FragCoord.xy / vec2(256,256);
    
    vec2 origin = vec2(1.0, 1.0);
    uv -= origin;
    
    float angle = radians(90.0) + atan(uv.y, uv.x);

    float len = length(uv) / 5.0;
    uv = vec2(cos(angle) * len, sin(angle) * len) + origin;
        
    gl_FragColor = mix(uStartColor, endColor, smoothstep(0.0, 1.0, uv.x));
}

