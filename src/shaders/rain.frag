#version 300 es

in vec2 vUV;
uniform sampler2D uTexture;
uniform float time;

out vec4 fragColor;
void main() {
    fragColor = texture(uTexture, vUV);//+ sin( (time + (vUV.x) * 14.) ) * 0.1 );
}