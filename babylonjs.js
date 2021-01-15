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
                        
                        function getMesh(payload, required) {
                            var mesh;
                            
                            if (payload.meshName && payload.meshName !== "") {
                                mesh = $scope.scene.getMeshByName(payload.meshName);
                            }
                            else if (payload.meshId && payload.meshId !== "") {
                                mesh = $scope.scene.getMeshByID(payload.meshId);
                            }
                            else {
                                logError("The meshName or meshId should be specified");
                                return null;   
                            }
                            
                            if (!mesh && required) {
                                logError("No mesh found with the specified id/name");
                                return null;
                            }
                            
                            return mesh;
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

                        function getVector(payload, fieldName) {
                            var fieldValue = payload[fieldName];
                            if (fieldValue == undefined || fieldValue.x == undefined || fieldValue.y == undefined || fieldValue.z == undefined ||
                                isNaN(fieldValue.x) || isNaN(fieldValue.y) || isNaN(fieldValue.z)) {
                                logError("The msg." + fieldName + " should contain x, y and z numbers");
                                return null;
                            }
                            
                            return new BABYLON.Vector3(fieldValue.x, fieldValue.y, fieldValue.z);
                        }
                        
                        function getRgbColor(payload, fieldName) {
                            var fieldValue = payload[fieldName];
                            if (fieldValue == undefined || fieldValue.r == undefined || fieldValue.g == undefined || fieldValue.b == undefined ||
                                isNaN(fieldValue.r) || isNaN(fieldValue.g) || isNaN(fieldValue.b)) {
                                logError("The msg." + fieldName + " should contain r, g and b numbers");
                                return null;
                            }
                            
                            return new BABYLON.Color3(fieldValue.r, fieldValue.g, fieldValue.b);
                        }                        
                        
                        function processCommand(payload, topic){
                            var mesh, light, material, camera;
                            var name = "";
                            var options = {};
                            var position, direction, alpha, beta, radius;
                            
                            var command = payload.command.toLowerCase();
                                        
                            try {
                                //debugger;
                                switch (command) {
                                    case "create_mesh":
                                        if (!payload.meshType || (typeof payload.meshType !== "string") ) {
                                            logError("The payload should contain a meshType");
                                            return;
                                        }
                                        
                                        // TODO check if name is required
                                        if (payload.name) {
                                            name = payload.meshName;
                                        }
                                        
                                        if (payload.options) {
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
                                        
                                        break;
                                    case "position_mesh":
                                        position = getVector(payload, "position");
                                        
                                        if (position) {
                                            mesh = getMesh(payload, true);
                                            
                                            if (mesh) {
                                                // Move the shape to the specified position
                                                mesh.position.x = position.x;
                                                mesh.position.y = position.y;
                                                mesh.position.z = position.z;
                                            }
                                        }
                                        break;
                                    case "rotate_mesh":
                                        radians = getVector(payload, "radians");
                                        
                                        if (radians) {
                                            mesh = getMesh(payload, true);
                                            
                                            if (mesh) {
                                                // Rotate the shape around the axes over the specified Euler angles (in radians)
                                                mesh.rotation.x = radians.x;
                                                mesh.rotation.y = radians.y;
                                                mesh.rotation.z = radians.z;
                                            }
                                        }
                                        break;
                                    case "create_light":
                                        if (!payload.type || (typeof payload.type !== "string") ) {
                                            logError("The payload should contain a light 'type'");
                                            return;
                                        }
                                        
                                        if (payload.name) {
                                            name = payload.lightName;
                                        }

                                        switch (payload.type) {
                                            case "pointLight":
                                                position = getVector(payload, "position");
                                                if (position) {
                                                    light = new BABYLON.PointLight(name, position, $scope.scene);
                                                }
                                                break;
                                            case "directionalLight":
                                                direction = getVector(payload, "direction");
                                                if (direction) {
                                                    light = new BABYLON.DirectionalLight(name, direction, $scope.scene);
                                                }
                                                break;
                                            case "spotLight":
                                                position = getPosition(payload, "position");
                                                direction = getVector(payload, "direction");
                                                if (position && direction) {
                                                    // TODO second vector should be adjustable
                                                    light = new BABYLON.SpotLight(name, vector, new BABYLON.Vector3(payload.direction.x, payload.direction.y, payload.direction.z), Math.PI / 3, 2, $scope.scene);
                                                }
                                                break;
                                            case "hemiLight":
                                                direction = getVector(payload, "direction");
                                                if (direction) {
                                                    light = new BABYLON.HemisphericLight(name, new BABYLON.Vector3(payload.direction.x, payload.direction.y, payload.direction.z), $scope.scene);
                                                }
                                                break;
                                        }
                                        break;
                                    case "update_light":
                                        // TODO kunnen we een light ophalen als een mesh???????
                                        light = getMesh(payload, true);
                                        
                                        if (light) {
                                            if (payload.payload.enable !== undefined && typeof payload.payload.enable === "boolean") {
                                                // Switch the light on or off
                                                light.setEnabled(payload.payload.enable);
                                            }
                                            
                                            if (payload.payload.intensity !== undefined && !isNaN(payload.payload.intensity)) {
                                                // Dim or brighten the light
                                                light.intensity = payload.payload.intensity;
                                            }
                                            
                                            if (payload.payload.range !== undefined && !isNaN(payload.payload.range)) {
                                                // Set how far the light reaches.  Note: this is only available for point and spot lights.
                                                light.range = payload.payload.range;
                                            }
                                        }
                                        break;
                                    case "create_material":
                                    case "update_material":
                                        if (payload.name) {
                                            name = payload.materialName;
                                        }

                                        if (command === "create_material") {
                                            material = new BABYLON.StandardMaterial(name, $scope.scene);
                                        }
                                        else {
                                            material = getMaterial(payload, true);
                                        }
                                        
                                        if (material) {
                                            var diffuseColor = getRgbColor(payload, "diffuseColor");
                                            if (diffuseColor) {
                                                material.diffuseColor = diffuseColor;
                                            }
                                            
                                            var specularColor = getRgbColor(payload, "specularColor");
                                            if (specularColor) {
                                                material.specularColor = specularColor;
                                            }

                                            var emissiveColor = getRgbColor(payload, "emissiveColor");
                                            if (emissiveColor) {
                                                material.emissiveColor = emissiveColor;
                                            }

                                            var ambientColor = getRgbColor(payload, "ambientColor");
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
                                        break;
                                    case "apply_mesh_material":
                                        mesh = getMesh(payload, true);
                                        
                                        if (mesh) {
                                            material = getMaterial(payload, true);
                                            
                                            if (material) {
                                                mesh.material = material;
                                            }
                                        }
                                        break;
                                    case "add_mesh_action":
                                        mesh = getMesh(payload, true);
                                        
                                        // An action manager is required on the mehs, in order to be able to execute actions
                                        if (!mesh.actionManager) {
                                            mesh.actionManager = new BABYLON.ActionManager($scope.scene);
                                        }
                                        
                                        var actionTrigger;
                                        if (!payload.actionTrigger || payload.actionTrigger === "" || (typeof payload.actionTrigger !== "string")) {
                                            logError("The payload should contain an actionTrigger");
                                            return;
                                        }
                                        
                                        switch (payload.actionTrigger) {
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
                                                logError("The specified actionTrigger is not supported");
                                                return;
                                        }

                                        // Register an action on the mesh for the specified action trigger.
                                        mesh.actionManager.registerAction(
                                            new BABYLON.ExecuteCodeAction(
                                                actionTrigger,
                                                function (evt) {
                                                    // Send an output message containing information about which action occured on which mesh
                                                    $scope.send({
                                                        meshName: mesh.name,
                                                        meshId: mesh.id,
                                                        topic: payload.actionTrigger
                                                    });
                                                }
                                            )
                                        );
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
                                        
                                        position = getVector(payload, "position");

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
                                
                                // ********************************************* TODO REMOVE TEST **************************************************
                                const box = BABYLON.MeshBuilder.CreateBox("my_box", {});
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
                            setTimeout(function(){ $scope.engine.resize(); }, 100);
                        }
                        
                        $scope.init = function (config) {
                            $scope.config = config;
                            
                            $scope.canvas = document.getElementById("babylonjsCanvas_" + config.id.replace(".","_"));
                            $scope.engine = new BABYLON.Engine($scope.canvas, true); // Generate the BABYLON 3D engine
                            
                            // Watch for browser/canvas resize events
                            window.addEventListener("resize", function () {
                                $scope.engine.resize();
                            });
         debugger;                   
                            var fileContent;
                            if ($scope.config.filename && $scope.config.filename !== "") {
                                var sceneFileUrl = "ui_babylonjs/" + $scope.config.id + "/scene/" + $scope.config.filename; 
                                
                                //$.ajax({
                                //    url: sceneFileUrl,
                                //    success: function(fileContent){
                                        BABYLON.SceneLoader.Load("", sceneFileUrl/*"data:" + fileContent*/, $scope.engine,
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
                                //    },
                                //    error: function(){
                                //        console.log("Unable to load the scene file from the server");
                                //        // Unable to load the scene file from the server, so start with a new scene from scratch
                                //        setupScene(null);
                                //    }
                                //});
                            }
                            else {
                                // No scene filename has been specified, so start with a new scene from scratch
                                setupScene(null);
                            }
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
	
    // Create the complete server-side path
    uiPath = '/' + uiPath + '/ui_babylonjs/:nodeid/:category/:filename';
    
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
                
                if (!fs.existsSync(fullPath)) {
                    console.log("The file (" + fullPath + ") does not exist");
                    res.status(404).json('Unexisting file');
                    return;
                }
                
                if (fs.lstatSync(fullPath).isDirectory()) {
                    console.log("The path (" + fullPath + ") is a directory instead of a file");
                    res.status(404).json('Directory instead of file');
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
