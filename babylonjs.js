/**
 * Copyright 2021 Bart Butenaers
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function(RED) {
    var settings = RED.settings;
    const fs = require('fs');
    const path = require('path');
/*
TODO

Alles in wireframe zetten:
https://playground.babylonjs.com/#HEW0MG#2

kleur van een mesh wijzigen:
pickedMesh.material.diffuseColor = BABYLON.Color3.Green()

if you add `<style>.nr-dashboard-ui_iframe { padding:0; }</style>` to the top of your widget html then it should fill the widget without the small grey border.
And also (yo may have this already) in your html file(s) you can replace "text/x-red" with "text/html" and it will syntax highlight easier in your local editor. (no need for x-red anymore)


Mogelijkheid om tags aan meshes toe te kennen, en dan daarop te gaan zoeken:
https://doc.babylonjs.com/divingDeeper/tags
*/


    
    // -------------------------------------------------------------------------------------------------
    // Determining the path to the files in the dependent babylonjs module once.
    // See https://discourse.nodered.org/t/use-files-from-dependent-npm-module/17978/5?u=bartbutenaers
    // -------------------------------------------------------------------------------------------------
    var babylonJsPath = require.resolve("babylonjs");

    if (!fs.existsSync(babylonJsPath)) {
        console.log("Javascript file " + babylonJsPath + " does not exist");
        babylonJsPath = null;
    }
    
    // -------------------------------------------------------------------------------------------------
    // Determining the path to the files in the dependent babylonjs-loaders module once.
    // See https://discourse.nodered.org/t/use-files-from-dependent-npm-module/17978/5?u=bartbutenaers
    // -------------------------------------------------------------------------------------------------
    var babylonJsLoadersPath = require.resolve("babylonjs-loaders");

    if (!fs.existsSync(babylonJsLoadersPath)) {
        console.log("Javascript file " + babylonJsLoadersPath + " does not exist");
        babylonJsLoadersPath = null;
    }
    
    // -------------------------------------------------------------------------------------------------
    // Determining the path to the files in the dependent babylonjs-loaders module once.
    // See https://discourse.nodered.org/t/use-files-from-dependent-npm-module/17978/5?u=bartbutenaers
    // -------------------------------------------------------------------------------------------------
    var pepJsPath = require.resolve("pepjs");

    if (!fs.existsSync(pepJsPath)) {
        console.log("Javascript file " + pepJsPath + " does not exist");
        pepJsPath = null;
    }

    function HTML(config) { 
        // The configuration is a Javascript object, which needs to be converted to a JSON string
        var configAsJson = JSON.stringify(config);

        // Make sure to set the width and height via CSS style (instead of the width and height html element attributes).
        // This way the dashboard can calculate the size of the div correctly.  See:
        // https://discourse.nodered.org/t/custom-ui-node-layout-problems/7731/21?u=bartbutenaers)
        // All the different types of file loaders (obj, gltf, ...) are included in babylon_loader.js.
        var html = String.raw`
        <script src="ui_babylonjs/null/js/babylon.js"></script>
        <script src="ui_babylonjs/null/js/babylon_loader.js"></script>
        <script src="ui_babylonjs/null/js/pep.js"></script>
        <canvas id="babylonjsCanvas_` + config.id.replace(".","_") + `" touch-action="none" style="width:100%; height:100%; touch-action:none;" ng-init='init(` + configAsJson + `)'></div>
        `;
        
        return html;
    };

    function checkConfig(node, conf) {
        if (!conf || !conf.hasOwnProperty("group")) {
            node.error("No group has been specified");
            return false;
        }
        return true;
    }
    
    function setResult(msg, field, value) {
        field = field ? field : "payload";
        const keys = field.split('.');
        const lastKey = keys.pop();
        const lastObj = keys.reduce((obj, key) => obj[key] = obj[key] || {}, msg); 
        lastObj[lastKey] = value;
    };
    
    var ui = undefined;
    
    function BabylonJsNode(config) {
        this.folder = config.folder;
        
        var node = this;

        try {
            if(ui === undefined) {
                ui = RED.require("node-red-dashboard")(RED);
            }
            
            RED.nodes.createNode(this, config);

            if (checkConfig(node, config)) { 
                node.outputField = config.outputField;
            
                var html = HTML(config);
                var done = ui.addWidget({
                    node: node,
                    group: config.group,
                    order: config.order, 
                    width: config.width,
                    height: config.height,
                    format: html,
                    templateScope: "local",
                    emitOnlyNewValues: false,
                    forwardInputMessages: false,
                    storeFrontEndInputAsState: false,
                    // Avoid msg being replayed after deploy.
                    // (see https://github.com/node-red/node-red-dashboard/pull/558)
                    persistantFrontEndValue: false,
                    convertBack: function (value) {
                        return value;
                    },
                    beforeEmit: function(msg, value) {
                        // ******************************************************************************************
                        // Server side validation of input messages.
                        // ******************************************************************************************
                        // Would like to ignore invalid input messages, but that seems not to possible in UI nodes:
                        // See https://discourse.nodered.org/t/custom-ui-node-not-visible-in-dashboard-sidebar/9666
                        // We will workaround it by sending a 'null' payload to the dashboard.
                        
                        return { msg: msg };
                    },
                    beforeSend: function (msg, orig) {
                        if (!orig || !orig.msg) {
                           return;//TODO: what to do if empty? Currently, halt flow by returning nothing
                        }
                        
                        // When an error message is being send from the client-side, just log the error
                        if (orig.msg.hasOwnProperty("error")) {
                            node.error(orig.msg.error);
                            
                            // Dirty hack to avoid that the error message is being send on the output of this node
                            orig["_fromInput"] = true; // Legacy code for older dashboard versions
                            orig["_dontSend"] = true; 
                            return;
                        }
                        
                        // When an event message is being send from the client-side, just log the event
                        // Bug fix: use "browser_event" instead of "event" because normal message (like e.g. on click) also contain an "event".
                        // See https://github.com/bartbutenaers/node-red-contrib-ui-svg/issues/77
                        if (orig.msg.hasOwnProperty("browser_event")) {
                            node.warn(orig.msg.browser_event);
                            
                            // Dirty hack to avoid that the event message is being send on the output of this node
                            orig["_fromInput"] = true; // Legacy code for older dashboard versions
                            orig["_dontSend"] = true; 
                            return;
                        }
                            
                        // Compose the output message    
                        let newMsg = {};
                        
                        // Copy some fields from the original output message.
                        // Note that those fields are not always available, e.g. when a $scope.send(...) is being called from a javascript event handler.
                        if (orig.msg.topic) {
                            newMsg.topic = orig.msg.topic;
                        }
                        if (orig.msg.payload) {
                            newMsg.payload = orig.msg.payload;
                        }                          
                        if (orig.msg.meshId) {
                            newMsg.meshId = orig.msg.meshId;
                        }  
                        if (orig.msg.meshName) {
                            newMsg.meshName = orig.msg.meshName;
                        }

                        // In the editableList of the clickable shapes, the content of the node.outputField property has been specified.
                        // Apply that content to the node.outputField property in the output message
                        RED.util.evaluateNodeProperty(orig.msg.payload,orig.msg.payloadType,node,orig.msg,(err,value) => {
                            if (err) {
                                return;//TODO: what to do on error? Currently, halt flow by returning nothing
                            } else {
                                setResult(newMsg, node.outputField, value); 
                            }
                        }); 
                        return newMsg;
                    },
                    initController: function($scope, events) {
                        $scope.flag = true;
  debugger;                      
                        function logError(error) {
                            // Log the error on the client-side in the browser console log
                            console.log(error);
                            
                            // Send the error to the server-side to log it there, if requested
                            if ($scope.config.showBrowserErrors) {
                                $scope.send({error: error});
                            }
                        }
                        
                        function getMeshes(payload, required) {
                            var mesh;
                            var meshes = [];
                            
                            if (payload.meshName && payload.meshName !== "") {
                                if (payload.meshName.startsWith("^")) {
                                    var regex = new RegExp(payload.meshName);
                                    
                                    
                                    $scope.scene.meshes.forEach(function (meshToTest) {
                                        if (meshToTest.name && regex.test(meshToTest.name)) {
                                             meshes.push(meshToTest);
                                        }
                                    });
                                }
                                else {
                                    mesh = $scope.scene.getMeshByName(payload.meshName);
                                }
                            }
                            else if (payload.meshId && payload.meshId !== "") {
                                mesh = $scope.scene.getMeshByID(payload.meshId);
                            }
                            else {
                                logError("The meshName or meshId should be specified");
                            }
            
                            if (mesh) {
                                meshes.push(mesh);
                            }
                            
                            if (required && meshes.length === 0) {
                                logError("No mesh found with the specified id/name");
                            }
                            
                            return meshes;
                        }
                        
                        function getLight(payload, required) {
                            var light;

                            if (payload.lightName && payload.lightName !== "") {
                                light = $scope.scene.getLightByName(payload.lightName);
                            }
                            else if (payload.lightId && payload.lightId !== "") {
                                light = $scope.scene.getLightByID(payload.lightId);
                            }
                            else {
                                logError("The lightName or lightId should be specified");
                                return null;
                            }
                            
                            if (!light && required) {
                                logError("No light found with the specified id/name");
                                return null;
                            }
                            
                            return light;
                        }

                        function getMaterial(payload, required) {
                            var material;

                            if (payload.materialName && payload.materialName !== "") {
                                material = $scope.scene.getMaterialByName(payload.materialName);
                            }
                            else if (payload.materialId && payload.materialId !== "") {
                                material = $scope.scene.getMaterialByID(payload.materialId);
                            }
                            else {
                                logError("The materialName or materialId should be specified");
                                return null;
                            }
                            
                            if (!material && required) {
                                logError("No material found with the specified id/name");
                                return null;
                            }
                            
                            return material;
                        }

                        function getVector(payload, fieldName, required) {
                            var fieldValue = payload[fieldName];
                            if (fieldValue == undefined || fieldValue.x == undefined || fieldValue.y == undefined || fieldValue.z == undefined ||
                                isNaN(fieldValue.x) || isNaN(fieldValue.y) || isNaN(fieldValue.z)) {
                                if (required) {
                                    logError("The msg." + fieldName + " should contain x, y and z numbers");
                                }
                                return null;
                            }
                            
                            return new BABYLON.Vector3(fieldValue.x, fieldValue.y, fieldValue.z);
                        }
                        
                        function getRgbColor(payload, fieldName, required) {
                            var fieldValue = payload[fieldName];
                            if (fieldValue == undefined || fieldValue.r == undefined || fieldValue.g == undefined || fieldValue.b == undefined ||
                                isNaN(fieldValue.r) || isNaN(fieldValue.g) || isNaN(fieldValue.b)) {
                                if (required) {
                                    logError("The msg." + fieldName + " should contain r, g and b numbers");
                                }
                                return null;
                            }
                            
                            // The applied r,g,b values are numbers from 0 to 255, while Color3/4 expect numbers between 0 and 1.
                            // When an extra alpha channel is specified, create a Color4 instance instead of a Color3 instance.
                            if (fieldValue != undefined && fieldValue.a != undefined && isNaN(fieldValue.a)) {
                                return new BABYLON.Color4.FromInts(fieldValue.r, fieldValue.g, fieldValue.b, fieldValue.a);
                            }
                            else {
                                return new BABYLON.Color3.FromInts(fieldValue.r, fieldValue.g, fieldValue.b);
                            }
                        }
                        
                        function applyActionToScene(actionTrigger, payloadToSend, topicToSend) {
                            // An action manager is required on the mesh, in order to be able to execute actions
                            if (!$scope.scene.actionManager) {
                                $scope.scene.actionManager = new BABYLON.ActionManager($scope.scene);
                            }

                            switch (actionTrigger) {
                                case "everyFrame":
                                    actionTrigger = BABYLON.ActionManager.OnEveryFrameTrigger;
                                    break;
                                case "keyDown":
                                    actionTrigger = BABYLON.ActionManager.OnKeyDownTrigger;
                                    break;
                                case "keyUp":
                                    actionTrigger = BABYLON.ActionManager.OnKeyUpTrigger;
                                    break;
                                default:
                                    logError("The specified actionTrigger is not supported for scenes");
                                    return;
                            }

                            // Register an action on the mesh for the specified action trigger.
                            $scope.scene.actionManager.registerAction(
                                new BABYLON.ExecuteCodeAction(
                                    actionTrigger,
                                    function (evt) {
                                        debugger;
                                        // Send an output message containing information about which action occured on the scene
                                        $scope.send({
                                            payload: payloadToSend,
                                            topic: topicToSend
                                        });
                                    }
                                )
                            );
                        }
                        
                        function applyActionToMesh(mesh, actionTrigger, payloadToSend, topicToSend) {
                            // An action manager is required on the mesh, in order to be able to execute actions
                            if (!mesh.actionManager) {
                                mesh.actionManager = new BABYLON.ActionManager($scope.scene);
                            }

                            switch (actionTrigger) {
                                case "nothing":
                                    actionTrigger = BABYLON.ActionManager.NothingTrigger;
                                    break;
                                case "pick":
                                    actionTrigger = BABYLON.ActionManager.OnPickTrigger;
                                    break;
                                case "doublePick":
                                    actionTrigger = BABYLON.ActionManager.OnDoublePickTrigger;
                                    break;
                                case "pickDown":
                                    actionTrigger = BABYLON.ActionManager.OnPickDownTrigger;
                                    break;
                                case "pickUp":
                                    actionTrigger = BABYLON.ActionManager.OnPickUpTrigger;
                                    break;
                                case "pickOut":
                                    actionTrigger = BABYLON.ActionManager.OnPickOutTrigger;
                                    break;
                                case "leftPick":
                                    actionTrigger = BABYLON.ActionManager.OnLeftPickTrigger;
                                    break;
                                case "rightPick":
                                    actionTrigger = BABYLON.ActionManager.OnRightPickTrigger;
                                    break;
                                case "centerPick":
                                    actionTrigger = BABYLON.ActionManager.OnCenterPickTrigger;
                                    break;
                                case "pointerOver":
                                    actionTrigger = BABYLON.ActionManager.OnPointerOverTrigger;
                                    break;
                                case "pointerOut":
                                    actionTrigger = BABYLON.ActionManager.OnPointerOutTrigger;
                                    break;
                                case "intersectionEnter":
                                    actionTrigger = BABYLON.ActionManager.OnIntersectionEnterTrigger;
                                    break;
                                case "intersectionExit":
                                    actionTrigger = BABYLON.ActionManager.OnIntersectionExitTrigger;
                                    break;
                                default:
                                    logError("The specified actionTrigger is not supported for meshes");
                                    return;
                            }

                            // Register an action on the mesh for the specified action trigger.
                            mesh.actionManager.registerAction(
                                new BABYLON.ExecuteCodeAction(
                                    actionTrigger,
                                    function (evt) {
                                        // Send an output message containing information about which action occured on which mesh
                                        $scope.send({
                                            payload: payloadToSend,
                                            topic: topicToSend
                                        });
                                    }
                                )
                            );
                        }
                        
                        function applyAction(selectorType, selector, actionTrigger, payloadToSend, topicToSend) {
                            payloadToSend = payloadToSend || "";
                            topicToSend = topicToSend || "";

                            switch(selectorType) {
                                case "scene":
                                    applyActionToScene(actionTrigger, payloadToSend, topicToSend);
                                    break;
                                case "meshid":
                                    meshes = getMeshes({meshId: selector}, true);
                                    
                                    meshes.forEach(function (meshForAction) {
                                        applyActionToMesh(meshForAction, actionTrigger, payloadToSend, topicToSend);
                                    });
                                    break;
                                case "tag":
                                // TODO getMeshesByTags nog implementeren !!!!!!!!!!!
                                    var taggedMeshes = getMeshesByTags(selector);
                                    
                                    taggedMeshes.forEach(function (taggedMesh, index) {
                                        applyActionToMesh(taggedMesh, actionTrigger, payloadToSend, topicToSend);
                                    });
                                    break;
                            }
                        }
                        
                        function sendMessageProperties(mesh) {
                            var boundingBox = mesh.getBoundingInfo().boundingBox;
    
                            // Send a subset of the mesh properties to the Node-RED server
                            $scope.send({
                                payload: {
                                    id: mesh.id,
                                    name: mesh.name,
                                    edgesColor: {
                                        r: mesh.edgesColor.r,
                                        g: mesh.edgesColor.g,
                                        b: mesh.edgesColor.b,
                                    },
                                    outlineWidth: mesh.outlineWidth,
                                    uniqueId: mesh.uniqueId,
                                    position: {
                                        x: mesh.absolutePosition.x,
                                        y: mesh.absolutePosition.y,
                                        z: mesh.absolutePosition.z
                                    },
                                    isVisible: mesh.isVisible,
                                    scaling: {
                                        x: mesh.scaling.x,
                                        y: mesh.scaling.y,
                                        z: mesh.scaling.z
                                    },
                                    rotation: {
                                        // Convert the angles from radians to degrees
                                        x: BABYLON.Tools.ToDegrees(mesh.rotation.x),
                                        y: BABYLON.Tools.ToDegrees(mesh.rotation.y),
                                        z: BABYLON.Tools.ToDegrees(mesh.rotation.z)
                                    },
                                    boundingBox: {
                                        minimum: {
                                            x: boundingBox.minimum.x,
                                            y: boundingBox.minimum.y,
                                            z: boundingBox.minimum.z
                                        },
                                        maximum: {
                                            x: boundingBox.maximum.x,
                                            y: boundingBox.maximum.y,
                                            z: boundingBox.maximum.z
                                        },
                                        center: {
                                            x: boundingBox.center.x,
                                            y: boundingBox.center.y,
                                            z: boundingBox.center.z 
                                        }
                                    }
                                }
                            });
                        }
                        
                        function updateMesh(payload, mesh) {
                            if (payload.outlineWidth) {
                                mesh.outlineWidth = payload.outlineWidth;
                            }
                            
                            var outlineColor = getRgbColor(payload, "outlineColor", false);
                            if (outlineColor) {
                                mesh.outlineColor = outlineColor;
                            }
                            
                            // Toggle the outline for the picked mesh
                            if(!mesh.renderOutline) {
                                mesh.renderOutline = true;
                                
                                sendMessageProperties(mesh);
                            }
                            else {
                                mesh.renderOutline = false;
                            }
                        }
                        
                        function updateMaterial(payload, material) {
                            diffuseColor = getRgbColor(payload, "diffuseColor", false);
                            if (diffuseColor) {
                                material.diffuseColor = diffuseColor;
                            }
                            
                            specularColor = getRgbColor(payload, "specularColor", false);
                            if (specularColor) {
                                material.specularColor = specularColor;
                            }

                            emissiveColor = getRgbColor(payload, "emissiveColor", false);
                            if (emissiveColor) {
                                material.emissiveColor = emissiveColor;
                            }

                            ambientColor = getRgbColor(payload, "ambientColor", false);
                            if (ambientColor) {
                                material.ambientColor = ambientColor;
                            }
                            
                            if (payload.alpha != undefined && !isNaN(payload.alpha)) {
                                // Set the transparency by setting a materials alpha property from 0 (invisible) to 1 (opaque).
                                material.alpha = payload.alpha;
                            }
                            
                            if (payload.wireframe != undefined && (typeof payload.wireframe === "boolean")) {
                                material.wireframe = payload.wireframe;
                            }
                        }
                        
                        function createAnimation(animationName, animatedMeshId, animatedProperty, frameRate, propertyType, loopMode, loop, startFrame, startTime, endFrame, endTime, keyFrames) {
                            propertyType = propertyType.toUpperCase();
                            loopMode = loopMode.toUpperCase();
                            
                            // Map the propertyType string to a BabylonJs value
                            switch(propertyType) {
                                case "COLOR3":
                                    propertyType = BABYLON.Animation.ANIMATIONTYPE_COLOR3;
                                    break;
                                case "FLOAT":
                                    propertyType = BABYLON.Animation.ANIMATIONTYPE_FLOAT;
                                    break;
                                case "MATRIX":
                                    propertyType = BABYLON.Animation.ANIMATIONTYPE_MATRIX;
                                    break;
                                case "QUATERNION":
                                    propertyType = BABYLON.Animation.ANIMATIONTYPE_QUATERNION;
                                    break;
                                case "VECTOR2":
                                    propertyType = BABYLON.Animation.ANIMATIONTYPE_VECTOR2;
                                    break;
                                case "VECTOR3":
                                    propertyType = BABYLON.Animation.ANIMATIONTYPE_VECTOR3;
                                    break;
                                default:
                                    console.log("The specified property type is not supported");
                                    return;
                            }

                            switch (loopMode) {
                                case "CYCLE":
                                    loopMode = BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE;
                                    break;
                                case "CONSTANT":
                                    loopMode = BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT;
                                    break;
                                case "RELATIVE":
                                    loopMode = BABYLON.Animation.ANIMATIONLOOPMODE_RELATIVE;
                                    break;
                                default:
                                    console.log("The specified loop mode is not supported");
                                    return;
                            }

                            // Convert the 'time' fields (in seconds) to 'frame' fields
                            keyFrames.forEach(function (keyFrame) {
                                // The 'time' field overrules a 'frame' field, if both fields have been specified
                                if (keyFrame.time != undefined) {
                                    keyFrame.frame = keyFrame.time * frameRate;
                                    delete keyFrame.time;
                                }

                                switch(propertyType) {
                                    case BABYLON.Animation.ANIMATIONTYPE_COLOR3:
                                        keyFrame.value = BABYLON.Color3.FromInts(keyFrame.value.r, keyFrame.value.g, keyFrame.value.b);
                                        break;
                                    case BABYLON.Animation.ANIMATIONTYPE_FLOAT:
                                        // TODO convert keyFrame.value
                                        break;
                                    case BABYLON.Animation.ANIMATIONTYPE_MATRIX:
                                        // TODO convert keyFrame.value
                                        break;
                                    case BABYLON.Animation.ANIMATIONTYPE_QUATERNION:
                                        // TODO convert keyFrame.value
                                        break;
                                    case BABYLON.Animation.ANIMATIONTYPE_VECTOR2:
                                        // TODO convert keyFrame.value
                                        break;
                                    case BABYLON.Animation.ANIMATIONTYPE_VECTOR3:
                                        // TODO convert keyFrame.value
                                        break;
                                    default:
                                        console.log("The specified property type is not supported");
                                        return;
                                }
                            });
                            
                            // A startTime overrules the startFrame, when both fields have been specified
                            if(startTime != undefined) {
                                // Convert the start time (in seconds) to the start frame
                                startFrame = startTime * frameRate;
                            }
                            
                            // An endTime overrules the endFrame, when both fields have been specified
                            if(endTime != undefined) {
                                // Convert the start time (in seconds) to the start frame
                                endFrame = endTime * frameRate;
                            }
                            
                            var meshes = getMeshes({meshId: animatedMeshId}, true);

                            meshes.forEach(function (meshToAnimate) {
                                var animation = new BABYLON.Animation(animationName, animatedProperty, frameRate, propertyType, loopMode);

                                animation.setKeys(keyFrames);

                                meshToAnimate.animations.push(animation);

                                $scope.scene.beginAnimation(meshToAnimate, startFrame, endFrame, loop);
                            });
                        }
                        
                        function processCommand(payload, topic){
                            var mesh, meshes, light, material, camera;
                            var name = "";
                            var options = {};
                            var position, direction, alpha, beta, radius, degrees, radians;
                            var diffuseColor, specularColor, emissiveColor, ambientColor;
                            
                            var command = payload.command.toLowerCase();
                                        
                            try {
                                debugger;
                                switch (command) {
                                    case "create_mesh":
                                        if (!payload.meshType || (typeof payload.meshType !== "string") ) {
                                            logError("The payload should contain a meshType");
                                            return;
                                        }
                                        
                                        // TODO check if name is required
                                        if (payload.meshName) {
                                            name = payload.meshName;
                                        }
                                        
                                        if (payload.meshOptions) {
                                            options = payload.meshOptions;
                                        }

                                        switch (payload.meshType) {
                                            case "box":
                                                mesh = BABYLON.MeshBuilder.CreateBox(name, options, $scope.scene);
                                                break;
                                            case "tiledBox":
                                                mesh = BABYLON.MeshBuilder.CreateTiledBox(name, options, $scope.scene);
                                                break;
                                            case "sphere":
                                                mesh = BABYLON.MeshBuilder.CreateSphere(name, options, $scope.scene);
                                                break;
                                            case "cylinder":
                                                mesh = BABYLON.MeshBuilder.CreateCylinder(name, options, $scope.scene);
                                                break;
                                            case "capsule":
                                                mesh = BABYLON.MeshBuilder.CreateCapsule(name, options, $scope.scene);
                                                break;
                                            case "plane":
                                                mesh = BABYLON.MeshBuilder.CreatePlane(name, options, $scope.scene);
                                                break;
                                            case "tiledPlane":
                                                mesh = BABYLON.MeshBuilder.CreateTiledPlane(name, options, $scope.scene);
                                                break;
                                            case "disc":
                                                mesh = BABYLON.MeshBuilder.CreateDisc(name, options, $scope.scene);
                                                break;
                                            case "torus":
                                                mesh = BABYLON.MeshBuilder.CreateTorus(name, options, $scope.scene);
                                                break;
                                            case "torusKnot":
                                                mesh = BABYLON.MeshBuilder.CreateTorusKnot(name, options, $scope.scene);
                                                break;
                                            case "ground":
                                                mesh = BABYLON.MeshBuilder.CreateGround(name, options, $scope.scene);
                                                break;
                                            case "groundFromHeightMap":
                                                // TODO validate payload.urlToHeightMap
                                                mesh = BABYLON.MeshBuilder.CreateGroundFromHeightMap(name, payload.urlToHeightMap, options, $scope.scene);
                                                break;
                                            case "tiledGround":
                                                mesh = BABYLON.MeshBuilder.CreateTiledGround(name, options, $scope.scene);
                                                break;
                                            case "lines":
                                                mesh = BABYLON.MeshBuilder.CreateLines(name, options, $scope.scene);
                                                break;
                                            case "dashedLines":
                                                mesh = BABYLON.MeshBuilder.CreateDashedLines(name, options, $scope.scene);
                                                break;
                                            case "lineSystem":
                                                mesh = BABYLON.MeshBuilder.CreateLineSystem(name, options, $scope.scene);
                                                break;
                                            case "ribbon":
                                                mesh = BABYLON.MeshBuilder.CreateRibbon(name, options, $scope.scene);
                                                break;
                                            case "tube":
                                                mesh = BABYLON.MeshBuilder.CreateTube(name, options, $scope.scene);
                                                break;
                                            case "extrusion":
                                                mesh = BABYLON.MeshBuilder.ExtrudeShape(name, options, $scope.scene);
                                                break;
                                            case "customExtrusion":
                                                mesh = BABYLON.MeshBuilder.ExtrudeShapeCustom(name, options, $scope.scene);
                                                break;
                                            case "lathe":
                                                mesh = BABYLON.MeshBuilder.CreateLathe(name, options, $scope.scene);
                                                break;
                                            case "polygon":
                                                mesh = BABYLON.MeshBuilder.CreatePolygon(name, options, $scope.scene);
                                                break;
                                            case "polygonExtrusion":
                                                mesh = BABYLON.MeshBuilder.ExtrudePolygon(name, options, $scope.scene);
                                                break;                                                
                                            case "polygonMesh":
                                                //TODO mesh = BABYLON.MeshBuilder.PolygonMeshBuilder(name, options, $scope.scene);
                                                break;      
                                            case "polyhedron":
                                                mesh = BABYLON.MeshBuilder.CreatePolyhedron(name, options, $scope.scene);
                                                break;
                                            case "icoSphere":
                                                mesh = BABYLON.MeshBuilder.CreateIcoSphere(name, options, $scope.scene);
                                                break;                                                   
                                            case "icoSphere":
                                                mesh = BABYLON.MeshBuilder.CreateIcoSphere(name, options, $scope.scene);
                                                break;                                                   
                                        }
                                        
                                        position = getVector(payload, "position", false);
                                        if (position) {
                                            mesh.position = position;
                                        }
                                        
                                        // If any properties have been specified in the message, apply those immediately to the new mesh
                                        updateMesh(payload, mesh);
                                        
                                        break;
                                    case "update_mesh":
                                        meshes = getMeshes(payload, true);
                                        
                                        meshes.forEach(function (meshToUpdate) {
                                            updateMesh(payload, meshToUpdate);
                                        });
                                        break;
                                    case "remove_mesh":
                                        meshes = getMeshes(payload, true);
                                        
                                        meshes.forEach(function (meshToDispose) {
                                            meshToDispose.dispose();
                                        });
                                        break;
                                    case "position_mesh":
                                        position = getVector(payload, "position", true);
                                        
                                        if (position) {
                                            meshes = getMeshes(payload, true);
                                            
                                            meshes.forEach(function (meshToPosition) {
                                                // Move the shape to the specified position
                                                meshToPosition.position.x = position.x;
                                                meshToPosition.position.y = position.y;
                                                meshToPosition.position.z = position.z;
                                            });
                                        }
                                        break;
                                    case "rotate_mesh":
                                        degrees = getVector(payload, "degrees", true);
                                        
                                        if (degrees) {
                                            meshes = getMeshes(payload, true);
                                            
                                            meshes.forEach(function (meshToRotate) {
                                                // Rotate the shape around the axes over the specified Euler angles (i.e. radians!!)
                                                meshToRotate.rotation.x = BABYLON.Tools.ToRadians(degrees.x);
                                                meshToRotate.rotation.y = BABYLON.Tools.ToRadians(degrees.y);
                                                meshToRotate.rotation.z = BABYLON.Tools.ToRadians(degrees.z);
                                            });
                                        }
                                        break;
                                    case "get_mesh_properties":
                                        meshes = getMeshes(payload, true);
                                        
                                        meshes.forEach(function (meshToGet) {
                                            sendMessageProperties(meshToGet);
                                        });
                                        break;
                                    case "create_light":
                                    case "update_light":
                                        light = getLight(payload, true);
                                        
                                        if (command === "create_light") {
                                            if (!payload.lightType || (typeof payload.lightType !== "string") ) {
                                                logError("The payload should contain a 'lightType'");
                                                return;
                                            }
                                            
                                            if (payload.lightName) {
                                                lightName = payload.lightName;
                                            }
                                            
                                            if (light) {
                                                // If a light already exist with the same name or id, then remove it
                                                light.dispose();
                                            }

                                            switch (payload.lightType) {
                                                case "pointLight":
                                                    position = getVector(payload, "position", true);
                                                    if (position) {
                                                        light = new BABYLON.PointLight(lightName, position, $scope.scene);
                                                    }
                                                    break;
                                                case "directionalLight":
                                                    direction = getVector(payload, "direction", true);
                                                    if (direction) {
                                                        light = new BABYLON.DirectionalLight(lightName, direction, $scope.scene);
                                                    }
                                                    break;
                                                case "spotLight":
                                                    position = getVector(payload, "position", true);
                                                    direction = getVector(payload, "direction", true);
                                                    if (position && direction) {
                                                        light = new BABYLON.SpotLight(lightName, new BABYLON.Vector3(position.x, position.y, position.z), new BABYLON.Vector3(direction.x, direction.y, direction.z), Math.PI / 3, 2, $scope.scene);
                                                    }
                                                    break;
                                                case "hemiLight":
                                                    direction = getVector(payload, "direction", true);
                                                    if (direction) {
                                                        light = new BABYLON.HemisphericLight(lightName, new BABYLON.Vector3(direction.x, direction.y, direction.z), $scope.scene);
                                                    }
                                                    break;
                                            }
                                        }
                                        else {
                                            if (!light) {
                                                console.log("There is no light with the specified id/name");
                                                return;
                                            }
                                        }
                                        
                                        diffuseColor = getRgbColor(payload, "diffuseColor", false);
                                        if (diffuseColor) {
                                        	light.diffuse = diffuseColor;
                                        }
                                        
                                        specularColor = getRgbColor(payload, "specularColor", false);
                                        if (specularColor) {
                                        	light.specular = specularColor;
                                        }

                                        if (payload.enableLight !== undefined && typeof payload.enableLight === "boolean") {
                                            // Switch the light on or off
                                            light.setEnabled(payload.enableLight);
                                        }
                                        
                                        if (payload.lightIntensity !== undefined && !isNaN(payload.lightIntensity)) {
                                            // Dim or brighten the light
                                            light.intensity = payload.lightIntensity;
                                        }
                                        
                                        if (payload.lightRange !== undefined && !isNaN(payload.lightRange)) {
                                            // Set how far the light reaches.  Note: this is only available for point and spot lights.
                                            light.range = payload.lightRange;
                                        }
                                        break;
                                    case "create_material":
                                        if (!payload.materialName) {
                                            logError("The payload should contain a 'materialName'");
                                            return;
                                        }

                                        // Create a new material with the specified name
                                        material = new BABYLON.StandardMaterial(payload.materialName, $scope.scene);
                                        
                                        // Update the material with settings from the input message
                                        updateMaterial(payload, material);
                                        
                                        // When an (optional) mesh name/id is specified, then apply the material immediately to that mesh
                                        meshes = getMeshes(payload, false);
                                        meshes.forEach(function (meshToUpdate) {
                                            meshToUpdate.material = material;
                                        });
                                        break;
                                    case "update_material":
                                        material = getMaterial(payload, true);

                                        if (material) {
                                            // Update the material with settings from the input message
                                            updateMaterial(payload, material);
                                            
                                            // When an (optional) mesh name/id is specified, then apply the material immediately to that mesh
                                            meshes = getMeshes(payload, false);
                                            meshes.forEach(function (meshToUpdate) {
                                                meshToUpdate.material = material;
                                            });
                                        }
                                        break;
                                    case "apply_mesh_material":
                                        meshes = getMeshes(payload, true);
                                        
                                        if (meshes.length > 0) {
                                            material = getMaterial(payload, true);
                                            
                                            meshes.forEach(function (meshToUpdate) {
                                                meshToUpdate.material = material;
                                            });
                                        }
                                        break;
                                    case "update_mesh_material":
                                        meshes = getMeshes(payload, true);
                                        
                                        meshes.forEach(function (meshToUpdate) {
                                            if (meshToUpdate.material) {
                                                // Update the mesh material with settings from the input message
                                                updateMaterial(payload, meshToUpdate.material);
                                            }
                                        });
                                        break;
                                    case "add_mesh_action":
                                        var actionTrigger;
                                        
                                        if (!payload.actionTrigger || payload.actionTrigger === "" || (typeof payload.actionTrigger !== "string")) {
                                            logError("The payload should contain an actionTrigger");
                                            return;
                                        }
                                        
                                        if (payload.selectorType !== "scene" || payload.selectorType !== "meshid" || payload.selectorType !== "tag") {
                                            logError("The payload should contain an actionTrigger");
                                            return;
                                        }

                                        applyAction(payload.selectorType, payload.selector, payload.actionTrigger, payload.payloadToSend, payload.topicToSend);
                                        break;
                                    case "create_animation":
                                        createAnimation(payload.animationName, payload.animatedMesh, payload.animatedProperty, payload.frameRate, payload.propertyType,
                                        payload.loopMode, payload.loop, payload.startFrame, payload.startTime, payload.endFrame, payload.endTime, payload.keyFrames);
                                        break;
                                    case "create_camera":
                                        if (!payload.cameraType || (typeof payload.cameraType !== "string") ) {
                                            logError("The payload should contain a cameraType");
                                            return;
                                        }
                                        
                                        // TODO check if name is required
                                        if (payload.name) {
                                            name = payload.meshName;
                                        }
                                        
                                        position = getVector(payload, "position", true);

                                        if (position) {
                                            switch (cameraType) {
                                                case "universal":
                                                    camera = new BABYLON.UniversalCamera(name, position, $scope.scene);
                                                    break;
                                                case "arcRotate":
                                                    /*
                                                    // Parameters: name, alpha, beta, radius, target position, scene
                                                    camera = new BABYLON.ArcRotateCamera(name, 0, 0, 10, position, $scope.scene);



                                                    // Targets the camera to a particular position. In this case the scene origin
                                                    camera.setTarget(BABYLON.Vector3.Zero());
                                                    // Attach the camera to the canvas
                                                    camera.attachControl(canvas, true);


                                                    // Parameters: name, position, scene
                                                    camera = new BABYLON.FollowCamera(name, position, $scope.scene);
                                                    // The goal distance of camera from target
                                                    camera.radius = 30;
                                                    // The goal height of camera above local origin (centre) of target
                                                    camera.heightOffset = 10;
                                                    // The goal rotation of camera around local origin (centre) of target in x y plane
                                                    camera.rotationOffset = 0;
                                                    // Acceleration of camera in moving from current to goal position
                                                    camera.cameraAcceleration = 0.005;
                                                    // The speed at which acceleration is halted
                                                    camera.maxCameraSpeed = 10;


                                                    // Parameters : name, position, eyeSpace, scene
                                                    camera = new BABYLON.AnaglyphUniversalCamera(name, position, 0.033, $scope.scene);


                                                    // Parameters : name, alpha, beta, radius, target, eyeSpace, scene
                                                    camera = new BABYLON.AnaglyphArcRotateCamera(name, -Math.PI / 2, Math.PI / 4, 20, new BABYLON.Vector3.Zero(), 0.033, $scope.scene);



                                                    // Parameters : name, position, scene
                                                    camera = new BABYLON.DeviceOrientationCamera(name, position, $scope.scene);
                                                    // Targets the camera to a particular position
                                                    camera.setTarget(new BABYLON.Vector3(0, 0, -10));
                                                    // Sets the sensitivity of the camera to movement and rotation
                                                    camera.angularSensibility = 10;
                                                    camera.moveSensibility = 10;



                                                    // Parameters: name, alpha, beta, radius, target position, scene
                                                    camera = new BABYLON.ArcRotateCamera(name, 0, 0, 10, position, $scope.scene);
                                                    // Positions the camera overwriting alpha, beta, radius
                                                    camera.setPosition(new BABYLON.Vector3(0, 0, 20));
                                                    // This attaches the camera to the canvas
                                                    camera.attachControl(canvas, true);
                                                    */
                                                    break;
                                            }
                                        }
                                        break;
                                    case "show_axes":
                                        if ($scope.axesViewer) {
                                            // When there are already axes displayed, remove those because the new ones might have other scaleLines
                                            $scope.axesViewer.dispose();
                                        }
                                        
                                        var scaleLines = 1;
                                    
                                        if (!isNaN(payload.scaleLines)) {
                                            scaleLines = payload.scaleLines;
                                        }
                                    
                                        $scope.axesViewer = new BABYLON.Debug.AxesViewer($scope.scene, scaleLines);
                                        break;                                        
                                    case "hide_axes":
                                        if ($scope.axesViewer) {
                                            $scope.axesViewer.dispose();
                                            $scope.axesViewer = null;
                                        }
                                        break;
                                    case "start_selection_mode":
                                        if (!$scope.scene.onPointerDown) {
                                            //Pointer Down with picking.
                                            $scope.scene.onPointerDown = function (evt, pickResult) {
                                                if ($scope.previousPick) {
                                                    $scope.previousPick.renderOutline = false;
                                                }
                                                
                                                // Check if pickResult hit a pickable mesh && that it indeed is a mesh
                                                if (pickResult.hit && pickResult.pickedMesh) {
                                                    var pickedMesh = pickResult.pickedMesh;
                                                    
                                                    $scope.previousPick = pickedMesh;
                                                    
                                                    if (payload.outlineWidth) {
                                                        pickedMesh.outlineWidth = payload.outlineWidth;
                                                    }
                                                    
                                                    var outlineColor = getRgbColor(payload, "outlineColor", false);
                                                    if (outlineColor) {
                                                        pickedMesh.outlineColor = outlineColor;
                                                    }
                                                    
                                                    // Toggle the outline for the picked mesh
                                                    if(!pickedMesh.renderOutline) {
                                                        pickedMesh.renderOutline = true;
                                                        
                                                        sendMessageProperties(pickedMesh);
                                                    }
                                                    else {
                                                        pickedMesh.renderOutline = false;
                                                    }
                                                }
                                            };
                                        }
                                        break;
                                    case "stop_selection_mode":
                                        $scope.scene.onPointerDown = null;
                                        break;
                                    //case "store_scene":
                                    //    var serializedScene = BABYLON.SceneSerializer.Serialize($scope.scene);
                                    //    $scope.serializedScene = JSON.stringify(serializedScene);
                                    //    break;
                                    //case "store_mesh":
                                    //    var serializedMesh = BABYLON.SceneSerializer.SerializeMesh(mesh);
                                    //    $scope.serializedMesh = JSON.stringify(serializedMesh);
                                    //    break;
                                    default:
                                        logError("Unsupported command '" + payload.command + "'");
                                }
                                
                            } 
                            catch (error) {
                                logError("Unexpected error when processing input message: " + error); 
                            }
                        }
                        
                        function setupScene(scene) {
                            // Create an emtpy scene from scratch, when no existing scene has been loaded
                            if (!scene) {
                                scene = new BABYLON.Scene($scope.engine);
                            }
                            
                            $scope.scene = scene;
                            
                            // Make sure there is always a camera available, to avoid "Uncaught Error: No camera defined".
                            // The second parameter specifies 'not' to replace the active camera, when already available in the scene
                            $scope.scene.createDefaultCamera(true, false, true);
                            
                            // Create a default light, but don't replace the existing one (if already available in the scene)
                            $scope.scene.createDefaultLight(false);
                                                            
                            // Register a render loop to repeatedly render the scene
                            $scope.engine.runRenderLoop(function () {
                                $scope.scene.render();
                            });

                            // At startup the meshes look blurred, and the mesh/scene actions are not triggered (until the window is resized).
                            // See https://forum.babylonjs.com/t/input-not-recognised-until-window-resize-triggered-or-change-focus/15653/7
                            // As a workaround I call the resize function very shortly after startup...
                            setTimeout(function(){ 
                            debugger;
                                if ($scope.engine) {
                                    $scope.engine.resize();
                                }
                            }, 100);

                            // Apply all the actions that have been specified in the node's config screen
                            $scope.config.actions.forEach(function (action, index) {
                                applyAction(action.selectorType, action.selector, action.action, action.payload, action.topic);
                            });
                        }
                        
                        $scope.init = function (config) {
                            $scope.config = config;
                            
                            $scope.canvas = document.getElementById("babylonjsCanvas_" + config.id.replace(".","_"));
                            $scope.engine = new BABYLON.Engine($scope.canvas, true); // Generate the BABYLON 3D engine

                            // Watch for browser/canvas resize actions
                            window.addEventListener("resize", function () {
                                if ($scope.engine) {
                                    $scope.engine.resize();
                                }
                            });
                            
                            $scope.$on("$destroy", function() {
                                if ($scope.scene) {
                                    $scope.scene.dispose();
                                    $scope.scene = null;
                                }

                                if ($scope.engine) {
                                    $scope.engine.dispose();
                                    $scope.engine = null;
                                }
                            });
         
                            // Start loading the scene asynchronous after 100 milliseconds.  This way the canvas will have
                            // its real size to fit into the parent div.  Otherwise the canvas will appear small (300 x 150)
                            // in the upper left of the screen, with a BabylonJs loading indicator that is much too large.
                            setTimeout(function(){ 
                                var fileContent;
                                if ($scope.config.filename && $scope.config.filename !== "") {
                                    // When a previous scene is available (don't know if that is possible?), then remove it
                                    if ($scope.scene) {
                                        $scope.scene.dispose();
                                        $scope.scene = null;
                                    }
                                    
                                    BABYLON.Tools.BaseUrl = "ui_babylonjs/" + $scope.config.id + "/scene/";

                                    BABYLON.SceneLoader.Load("", $scope.config.filename, $scope.engine,
                                    /*onSuccess*/function (newScene) {
                                        setupScene(newScene);
                                    },
                                    /*onProgress*/function (event) {
                                    },
                                    /*onError*/function (scene, message, exception) {
                                        console.log("Unable to load the file into the scene");
                                        // Unable to load the scene file from the server, so start with a new scene from scratch
                                        setupScene(null);
                                    });
                                }
                                else {
                                    // No scene filename has been specified, so start with a new scene from scratch
                                    setupScene(null);
                                }
                            }, 100);
                        }

                        $scope.$watch('msg', function(msg) {
                            // Ignore undefined messages.
                            if (!msg) {
                                return;
                            }
                            
                            var payload = msg.payload;
                            var topic = msg.topic;
           
                            if (!payload || payload === "") {
                                logError("Missing msg.payload");
                                return;
                            }
                            
                            if(!Array.isArray(payload)){
                                payload = [payload];
                            }
                            
                            payload.forEach(function(val,idx){
                                if(typeof val != "object" || !val.command) {
                                    logError("The msg.payload should contain an object (or an array of objects) which have a 'command' property.");
                                }
                                else {   
                                    processCommand(val);
                                }
                            })
                        });
                    }
                });
            }
        }
        catch (e) {
            // Server side errors 
            node.error(e);
            console.trace(e); // stacktrace
        }
		
        node.on("close", function() {
            if (done) {
                done();
            }
        });
    }

    RED.nodes.registerType("ui_babylon_js", BabylonJsNode);
    
    // By default the UI path in the settings.js file will be in comment:
    //     //ui: { path: "ui" },
    // But as soon as the user has specified a custom UI path there, we will need to use that path:
    //     ui: { path: "mypath" },
    var uiPath = (RED.settings.ui || {}).path;
    
    // When there was no ui path specified (i.e. '//ui: { path: "ui" }' not commented out in the settings.js file), then
    // we need to apply the default 'ui' path.  However, when an empty ui path has been specified (i.e. '//ui: { path: "" }'), then
    // we should also use an empty ui path...  See https://github.com/bartbutenaers/node-red-contrib-ui-svg/issues/86
    if (uiPath == undefined) {
        uiPath = 'ui';
    }
	
    // Create the complete server-side path.
    // The wildcard (*) at the end, is to allow that the 'filename' request parameter can contains slashes.
    // Indeed when a 3d file is loaded into the client, that file might contain links to other files (e.g. textures) which are located in subfolders.
    uiPath = '/' + uiPath + '/ui_babylonjs/:nodeid/:category/:filename*';
    
    // Replace a sequence of multiple slashes (e.g. // or ///) by a single one
    uiPath = uiPath.replace(/\/+/g, '/');
	
    // Make all the static resources from this node public available (i.e. babylonjs.js files).
    RED.httpNode.get(uiPath, function(req, res) {
        switch (req.params.category) {
            case "js":
                // Send the requested javascript library file to the client
                switch(req.params.filename) {
                    case "babylon.js":
                        res.sendFile(babylonJsPath);
                        break;
                    case "babylon_loader.js":
                        res.sendFile(babylonJsLoadersPath);
                        break;
                    case "pep.js":
                        res.sendFile(pepJsPath);
                        break;
                    default:
                        console.log("Unknown resource " + req.params[0]);
                        res.status(404).json('Unknown resource');                
                }
                break;
            case "scene":
                var node = RED.nodes.getNode(req.params.nodeid);
                
                if (!node) {
                    console.log("Unknown node with id " + req.params.nodeid);
                    res.status(404).json('Unknown node id');
                    return;
                }

                if (!node.folder || node.folder === "") {
                    console.log("No folder is specified in node with id " + req.params.nodeid);
                    res.status(404).json('No folder');
                    return;
                }
                    
                if (!node.folder || node.folder === "") {
                    console.log("No folder is specified in node with id " + req.params.nodeid);
                    res.status(404).json('No folder');
                    return;
                }
                
                var fullPath = path.join(node.folder, req.params.filename);
                
                if (fs.lstatSync(fullPath).isDirectory()) {
                    if (req.params[0]) {
                        // If the 'filename' request parameter contains subfolders, then (based on the wildcard above in the route):
                        // - The subfolders will be available inside req.params.filename
                        // - The file name will be available inside req.params[0]
                        fullPath = path.join(fullPath, req.params[0]);
                    }
                    else {
                        console.log("The path (" + fullPath + ") is a directory instead of a file");
                        res.status(404).json('Directory instead of file');
                        return;
                    }
                }
                
                if (!fs.existsSync(fullPath)) {
                    console.log("The file (" + fullPath + ") does not exist");
                    res.status(404).json('Unexisting file');
                    return;
                }

                // Search the requested file in the specified folder, and return it to the requestor
                res.sendFile(fullPath);
                break;
            default:
                console.log("The category (" + req.params.category + ") in the url is not supported");
                res.status(404).json('Unknown category');
        }
    });
}
