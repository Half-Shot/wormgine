#version 300 es
precision mediump float;

in vec2 aPosition;
in vec2 aUVs;
out vec2 vTextureCoord;

uniform mat3  uProjectionMatrix;
uniform mat3  uWorldTransformMatrix;
uniform mat3  uTransformMatrix;
uniform float iTime;
uniform vec4  inputSize;
uniform vec4  outputFrame;

void main() {
    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
	gl_Position.y += cos((iTime)+aPosition.x*0.125)*0.015;
    vTextureCoord = aPosition * (outputFrame.zw * inputSize.zw);
}