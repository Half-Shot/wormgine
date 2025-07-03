#version 300 es

in vec2 vUV;
in vec4 vColor;
uniform sampler2D uTexture;

out vec4 fragColor;
void main() {
    fragColor = texture(uTexture, vUV) * vColor;
}