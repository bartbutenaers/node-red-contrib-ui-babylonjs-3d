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


    // Note that BabylonJs offers two version of all their packages on npm: one version with "@" and one version without it.
    // For example "babylonjs-gui" and also "@babylonjs/gui".
    // The packages with "@" are es6 modules (to be used with 'import'), so we need to packages without "@" (to be used with 'require').
    
    // -------------------------------------------------------------------------------------------------
    // Determining the path to the files in the dependent babylonjs module once.
    // See https://discourse.nodered.org/t/use-files-from-dependent-npm-module/17978/5?u=bartbutenaers
    // -------------------------------------------------------------------------------------------------
    var babylonJsPath = require.resolve("babylonjs");
    // TODO change this
    var babylonJsPath = babylonJsPath.replace("babylon.js", "babylon.max.js"); // Enable this unminified babylonjs version for debugging

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
    // Determining the path to the files in the dependent babylonjs-gui module once.
    // See https://discourse.nodered.org/t/use-files-from-dependent-npm-module/17978/5?u=bartbutenaers
    // -------------------------------------------------------------------------------------------------
    var babylonJsGuiPath = require.resolve("babylonjs-gui");

    if (!fs.existsSync(babylonJsGuiPath)) {
        console.log("Javascript file " + babylonJsGuiPath + " does not exist");
        babylonJsGuiPath = null;
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
    
    // -------------------------------------------------------------------------------------------------
    // Determining the path to the files in the dependent earcut module once.
    // See https://discourse.nodered.org/t/use-files-from-dependent-npm-module/17978/5?u=bartbutenaers
    // -------------------------------------------------------------------------------------------------
    // See https://github.com/BabylonJS/Babylon.js/issues/5749#issuecomment-561847731
    var earcutPath = require.resolve("earcut");

    // The ...\src\earcut.js file should be replaced by the minified version to be used in the browser, to
    // avoid "Uncaught ReferenceError: module is not defined".  See https://github.com/mapbox/earcut/issues/61
    earcutPath = path.join(earcutPath.split("src")[0], "dist", "earcut.min.js");

    if (!fs.existsSync(earcutPath)) {
        console.log("Javascript file " + earcutPath + " does not exist");
        earcutPath = null;
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
        <script src="ui_babylonjs/null/js/babylon_gui.js"></script>
        <script src="ui_babylonjs/null/js/pep.js"></script>
        <script src="ui_babylonjs/null/js/earcut.js"></script>
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
                        if (orig.msg.id) {
                            newMsg.id = orig.msg.id;
                        }  
                        if (orig.msg.name) {
                            newMsg.name = orig.msg.name;
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

                        function logError(error) {
                            // Log the error on the client-side in the browser console log
                            console.log(error);
                            
                            // Send the error to the server-side to log it there, if requested
                            if ($scope.config.showBrowserErrors) {
                                $scope.send({error: error});
                            }
                        }
                        
                        // Check if a (nested) property exists
                        function checkPropertyExists(obj, propertyName) {
                            var propertyNames = propertyName.split(".");

                            for (var i = 0; i < propertyNames.length; i++) {
                                if (!obj || obj[propertyNames[i]] === undefined) {
                                    return false;
                                }
                                obj = obj[propertyNames[i]];
                            }
                            return true;
                        }
                        
                        // Get a (nested) property value.  
                        // Returns a null if the property not exists.
                        /*function getPropertyValue(obj, propertyName) {
                            var propertyNames = propertyName.split(".");

                            for (var i = 0; i < propertyNames.length; i++) {
                                if (!obj || !obj.hasOwnProperty(propertyNames[i])) {
                                    return null;
                                }
                                obj = obj[propertyNames[i]];
                            }
                            return obj;
                        }*/
                        
                        // Gets the meshes based on id, name, tag
                        function getMeshes(payload, required) {
                            var mesh;
                            var meshes = [];

                            if (payload.name && payload.name !== "") {
                                if (Array.isArray(payload.name)) {
                                    payload.name.forEach(function(name) {
                                        meshes.push($scope.scene.getMeshByName(name));
                                    });
                                }
                                if (payload.name.startsWith("^")) {
                                    var regex = new RegExp(payload.name);

                                    $scope.scene.meshes.forEach(function (meshToTest) {
                                        if (meshToTest.name && regex.test(meshToTest.name)) {
                                             meshes.push(meshToTest);
                                        }
                                    });
                                }
                                else {
                                    mesh = $scope.scene.getMeshByName(payload.name);
                                }
                            }
                            else if (payload.id && payload.id !== "") {
                                mesh = $scope.scene.getMeshByID(payload.id);
                            }
                            else if (payload.tag && payload.tag) {
                                mesh = $scope.scene.getMeshesByTags(payload.tag);
                            }
                            else {
                                if (required) {
                                    logError("The name or id of the mesh should be specified");
                                }
                            }
            
                            if (mesh) {
                                meshes.push(mesh);
                            }
                            
                            if (required && meshes.length === 0) {
                                logError("No meshes found with the specified name or id");
                            }
                            
                            return meshes;
                        }

                        // Gets the transform nodes based on id, name, tag
                        function getTransformNodes(payload, required) {
                            var transformNode;
                            var transformNodes = [];

                            if (payload.name && payload.name !== "") {
                                if (Array.isArray(payload.name)) {
                                    payload.name.forEach(function(name) {
                                        transformNodes.push($scope.scene.getTransformNodeByName(name));
                                    });
                                }
                                if (payload.name.startsWith("^")) {
                                    var regex = new RegExp(payload.name);

                                    $scope.scene.transformNodes.forEach(function (transformNodeToTest) {
                                        if (transformNodeToTest.name && regex.test(transformNodeToTest.name)) {
                                             transformNodes.push(transformNodeToTest);
                                        }
                                    });
                                }
                                else {
                                    transformNode = $scope.scene.getTransformNodeByName(payload.name);
                                }
                            }
                            else if (payload.id && payload.id !== "") {
                                transformNode = $scope.scene.getTransformNodeByID(payload.id);
                            }
                            else if (payload.tag && payload.tag) {
                                transformNode = $scope.scene.getTransformNodesByTags(payload.tag);
                            }
                            else {
                                if (required) {
                                    logError("The name or id of the transform node should be specified");
                                }
                            }
            
                            if (transformNode) {
                                transformNodes.push(transformNode);
                            }
                            
                            if (required && transformNodes.length === 0) {
                                logError("No transform nodes found with the specified name or id");
                            }
                            
                            return transformNodes;
                        }

                        function getLights(payload, required) {
                            var light;
                            var lights = [];

                            if (payload.name && payload.name !== "") {
                                if (Array.isArray(payload.name)) {
                                    payload.name.forEach(function(name) {
                                        lights.push($scope.scene.getLightByName(name));
                                    });
                                }
                                if (payload.name.startsWith("^")) {
                                    var regex = new RegExp(payload.name);

                                    $scope.scene.lights.forEach(function (lightToTest) {
                                        if (lightToTest.name && regex.test(lightToTest.name)) {
                                             lights.push(lightToTest);
                                        }
                                    });
                                }
                                else {
                                    light = $scope.scene.getLightByName(payload.name);
                                }
                            }
                            else if (payload.id && payload.id !== "") {
                                light = $scope.scene.getLightByID(payload.id);
                            }
                            else {
                                if (required) {
                                    logError("The name or id of the light should be specified");
                                }
                            }
                            
                            if (light) {
                                lights.push(light);
                            }
                            
                            if (required && lights.length === 0) {
                                logError("No lights found with the specified name or id");
                            }
                            
                            return lights;
                        }

                        function getMaterials(payload, required) {
                            var material;
                            var materials = [];

                            if (payload.name && payload.name !== "") {
                                if (Array.isArray(payload.name)) {
                                    payload.name.forEach(function(name) {
                                        materials.push($scope.scene.getMeshByName(name));
                                    });
                                }
                                if (payload.name.startsWith("^")) {
                                    var regex = new RegExp(payload.name);

                                    $scope.scene.materials.forEach(function (materialToTest) {
                                        if (materialToTest.name && regex.test(materialToTest.name)) {
                                             materials.push(materialToTest);
                                        }
                                    });
                                }
                                else {
                                    material = $scope.scene.getMaterialByName(payload.name);
                                }
                            }
                            else if (payload.id && payload.id !== "") {
                                material = $scope.scene.getMaterialByID(payload.id);
                            }
                            else {
                                if(required) {
                                    logError("The name or id of the material should be specified");
                                }
                            }
                            
                            if (material) {
                                materials.push(material);
                            }
                            
                            if (required && materials.length === 0) {
                                if (required) {
                                    logError("No materials found with the specified name or id");
                                }
                            }
                            
                            return materials;
                        }
                        
                        function getGuiControls(payload, required) {
                            var control;
                            var controls = [];

                            if (payload.name && payload.name !== "") {
                                control = BABYLON.GUI.AdvancedDynamicTexture.getControlByName(payload.name);
                            }
                            else {
                                if(required) {
                                    logError("The name or id of the control should be specified");
                                }
                            }
                            
                            if (control) {
                                controls.push(control);
                            }
                            
                            if (required && controls.length === 0) {
                                if (required) {
                                    logError("No controls found with the specified name or id");
                                }
                            }
                            
                            return controls;
                        }
                        
                        function getCameras(payload, required) {
                            var camera;
                            var cameras = [];

                            if (payload.name && payload.name !== "") {
                                if (Array.isArray(payload.name)) {
                                    payload.name.forEach(function(name) {
                                        cameras.push($scope.scene.getCameraByNameSearch (name));
                                    });
                                }
                                if (payload.name.startsWith("^")) {
                                    var regex = new RegExp(payload.name);

                                    $scope.scene.cameras.forEach(function (cameraToTest) {
                                        if (cameraToTest.name && regex.test(cameraToTest.name)) {
                                             cameras.push(cameraToTest);
                                        }
                                    });
                                }
                                else {
                                    camera = $scope.scene.getCameraByName(payload.name);
                                }
                            }
                            else if (payload.id && payload.id !== "") {
                                camera = $scope.scene.getCameraByID(payload.id);
                            }
                            else {
                                if (required) {
                                    logError("The name or id of the camera should be specified");
                                }
                            }
                            
                            if (camera) {
                                cameras.push(camera);
                            }
                            
                            if (required && cameras.length === 0) {
                                logError("No cameras found with the specified name or id");
                            }
                            
                            return cameras;
                        }
                        
                        // A node can be a mesh, light or camera
                        function getNodes(payload, required) {
                            var meshes = getMeshes(payload, false);
                            var lights = getLights(payload, false);
                            var cameras = getCameras(payload, false);
                            
                            // Create 1 array with all type of nodes
                            var nodes = meshes.concat(lights, cameras);
                            
                            if (nodes.length === 0 && required) {
                                logError("No nodes (meshes, lights, camera's) found with the specified name or id");
                            }
                            
                            return nodes;
                        }

                        // Vector4 is currently not supported yet in this function...
                        function getVector(payload, fieldName, required) {
                            var fieldValue = payload[fieldName];
                            if (fieldValue == undefined || fieldValue.x == undefined || fieldValue.y == undefined || fieldValue.z == undefined ||
                                isNaN(fieldValue.x) || isNaN(fieldValue.y) || isNaN(fieldValue.z)) {
                                if (required) {
                                    logError("The msg." + fieldName + " should contain x, y and z numbers");
                                }
                                return null;
                            }
                            
                            // When an extra 'w' coordinate is specified, create a Vector4 instance instead of a Vector3 instance.
                            if (fieldValue != undefined && fieldValue.w != undefined && isNaN(fieldValue.w)) {
                                return new BABYLON.Vector4(fieldValue.x, fieldValue.y, fieldValue.z, fieldValue.w);
                            }
                            else {
                                return new BABYLON.Vector3(fieldValue.x, fieldValue.y, fieldValue.z);
                            }
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
                            if (fieldValue != undefined && fieldValue.a != undefined && !isNaN(fieldValue.a)) {
                                return new BABYLON.Color4.FromInts(fieldValue.r, fieldValue.g, fieldValue.b, fieldValue.a);
                            }
                            else {
                                return new BABYLON.Color3.FromInts(fieldValue.r, fieldValue.g, fieldValue.b);
                            }
                        }
                        
                        // One dimensional arrays of colors are also supported
                        function convertToRgbColor(obj, fieldName) {
                            if (obj) {
                                if (obj.hasOwnProperty(fieldName)) {
                                    var fieldValue = obj[fieldName];
                                    
                                    if (Array.isArray(fieldValue)) {
                                        // When dealing with an array of colors, replace every item in the array by the color
                                        fieldValue.forEach(function(item, index, array) {
                                            array[index] = getRgbColor({color: item}, "color", false);
                                        });
                                    }
                                    else {
                                        obj[fieldName] = getRgbColor(obj, fieldName, false);
                                    }
                                }
                            }
                        }
                        
                        //  One and two dimensional arrays of vectors are also supported
                        function convertToVector(obj, fieldName) {
                            if (obj) {
                                if (obj.hasOwnProperty(fieldName)) {
                                    var fieldValue = obj[fieldName];
                                    
                                    if (Array.isArray(fieldValue)) {
                                        // When dealing with an array of vectors, replace every item in the array by the vector
                                        fieldValue.forEach(function(item1, index1, array1) {
                                            if (Array.isArray(array1[index1])) {
                                                // When dealing with a 2-dimensional array of vectors, replace every item in the sub-array by the vector
                                                array1[index1].forEach(function(item2, index2, array2) {
                                                    array2[index2] = getVector({vector: item2}, "vector", false);
                                                });
                                            }
                                            else {
                                                array1[index1] = getVector({vector: item1}, "vector", false);
                                            }
                                        });
                                    }
                                    else {
                                        obj[fieldName] = getVector(obj, fieldName, false);
                                    }
                                }
                            }
                        }
                        
                        function applyActionToScene(actionTrigger, payloadToSend, topicToSend) {
                            payloadToSend = payloadToSend || "";
                            topicToSend = topicToSend || "";

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
                            payloadToSend = payloadToSend || "";
                            topicToSend = topicToSend || "";
                            
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

                        function sendMeshProperties(mesh) {
                            var boundingBox = mesh.getBoundingInfo().boundingBox;
                            var absolutePosition = mesh.getAbsolutePosition();
                            
                            var payload = {
                                id: mesh.id,
                                name: mesh.name,
                                className: mesh.getClassName(),
                                edgesColor: {
                                    r: mesh.edgesColor.r * 255,
                                    g: mesh.edgesColor.g * 255,
                                    b: mesh.edgesColor.b * 255
                                },
                                outlineWidth: mesh.outlineWidth,
                                uniqueId: mesh.uniqueId,
                                position: {
                                    x: absolutePosition.x,
                                    y: absolutePosition.y,
                                    z: absolutePosition.z
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
    
                            // Send a subset of the mesh properties to the Node-RED server.
                            // Remark: BABYLON.SceneSerializer.SerializeMesh(mesh) contains too much info that is not relevant for this case.
                            $scope.send({
                                payload: payload
                            });
                        }
                        
                        function sendLightProperties(light) {
                            var absolutePosition = light.getAbsolutePosition();
                            
                            var payload = {
                                id: light.id,
                                name: light.name,
                                className: light.getClassName(),
                                position: {
                                    x: absolutePosition.x,
                                    y: absolutePosition.y,
                                    z: absolutePosition.z
                                },
                                diffuse: {
                                    r: light.diffuse.r * 255,
                                    g: light.diffuse.g * 255,
                                    b: light.diffuse.b * 255
                                },
                                specular: {
                                    r: light.specular.r * 255,
                                    g: light.specular.g * 255,
                                    b: light.specular.b * 255
                                },
                                range: light.range,
                                intensity: light.intensity
                            }
                            
                            // Not all ligth types have a direction
                            if (light.direction) {
                                payload.direction = {
                                    x: light.direction.x,
                                    y: light.direction.y,
                                    z: light.direction.z
                                }
                            }

                            // Send a subset of the light properties to the Node-RED server
                            $scope.send({
                                payload: payload
                            });
                        }
                        
                        function sendCameraProperties(camera) {
                            var payload = {
                                id: camera.id,
                                name: camera.name,
                                className: camera.getClassName(),
                                cameraDirection: { // TODO: rename to 'direction'??
                                    x: camera.cameraDirection.x,
                                    y: camera.cameraDirection.y,
                                    z: camera.cameraDirection.z
                                },
                                cameraRotation: { // TODO: rename to 'rotation'??
                                    x: camera.cameraRotation.x,
                                    y: camera.cameraRotation.y,
                                    z: camera.cameraRotation.z
                                },
                                position: {
                                    x: camera.position._x,
                                    y: camera.position._y,
                                    z: camera.position._z
                                },
                                targetPosition: {
                                    x: camera.target.x,
                                    y: camera.target.y,
                                    z: camera.target.z,
                                }
                            }

                            // Send a subset of the light properties to the Node-RED server
                            $scope.send({
                                payload: payload
                            });

                        }
                        
                        function updateMesh(payload, mesh) {
                            if (payload.parent) {
                                var transformNodes = getTransformNodes(payload.parent, false);
                                
                                if (transformNodes.length == 0) {
                                    logError("No transform nodes found with the specified payload.parent information");
                                    return;
                                }
                                
                                if (transformNodes.length > 1) {
                                    logError("More than one transform nodes found with the specified payload.parent information");
                                    return;
                                }
                                
                                mesh.parent = transformNodes[0];
                            }
                            
                            var position = getVector(payload, "position", false);
                            if (position) {
                                mesh.position = position;
                            }
                           
                            var rotation = getVector(payload, "rotation", false);
                            if (rotation) {
                                // Rotate the shape around the axes over the specified Euler angles (i.e. radians!!)
                                mesh.rotation.x = BABYLON.Tools.ToRadians(rotation.x);
                                mesh.rotation.y = BABYLON.Tools.ToRadians(rotation.y);
                                mesh.rotation.z = BABYLON.Tools.ToRadians(rotation.z);
                            }

                            var scaling = getVector(payload, "scaling", false);
                            if (scaling) {
                                mesh.scaling = scaling;
                            }

                            if (payload.enabled !== undefined && typeof payload.enabled === "boolean") {
                                // Switch the mesh visibility on or off
                                mesh.setEnabled(payload.enabled);
                            }
                                        
                            if (payload.outlineWidth) {
                                mesh.outlineWidth = payload.outlineWidth;
                            }
                            
                            var outlineColor = getRgbColor(payload, "outlineColor", false);
                            if (outlineColor) {
                                mesh.outlineColor = outlineColor;
                            }

                            // Toggle the outline for the picked mesh
                            if(payload.renderOutline != undefined) {
                                if (payload.renderOutline == true) {
                                    mesh.renderOutline = true;
                                }
                                else {
                                    mesh.renderOutline = false;
                                }
                            }

                            var overlayColor = getRgbColor(payload, "overlayColor", false);
                            if (overlayColor) {
                                mesh.overlayColor = overlayColor;
                            }
                            
                            // Toggle the overlay for the picked mesh
                            if(payload.renderOverlay != undefined) {
                                if (payload.renderOverlay == true) {
                                    mesh.renderOverlay = true;
                                }
                                else {
                                    mesh.renderOverlay = false;
                                }
                            }

                            // Toggle the edges for the picked mesh
                            if(payload.renderEdges != undefined) {
                                if (payload.renderEdges == true) {
                                    mesh.enableEdgesRendering();
                                }
                                else {
                                    mesh.disableEdgesRendering();
                                }
                            }
                            
                            if (payload.edgesWidth) {
                                mesh.edgesWidth = payload.edgesWidth;
                            }                            

                            var edgesColor = getRgbColor(payload, "edgesColor", false);
                            if (edgesColor) {
                                mesh.edgesColor = edgesColor;
                            }
 
                            // Toggle the bounding box for the picked mesh
                            if(payload.showBoundingBox != undefined) {
                                if (payload.showBoundingBox == true) {
                                    mesh.showBoundingBox = true;
                                }
                                else {
                                    mesh.showBoundingBox = false;
                                }
                            }
                        }

                        function updateTransformNode(payload, transformNode) {
                            var position = getVector(payload, "position", false);
                            if (position) {
                                transformNode.position = position;
                            }
                           
                            var rotation = getVector(payload, "rotation", false);
                            if (rotation) {
                                // Rotate the shape around the axes over the specified Euler angles (i.e. radians!!)
                                transformNode.rotation.x = BABYLON.Tools.ToRadians(rotation.x);
                                transformNode.rotation.y = BABYLON.Tools.ToRadians(rotation.y);
                                transformNode.rotation.z = BABYLON.Tools.ToRadians(rotation.z);
                            }

                            if (payload.enabled !== undefined && typeof payload.enabled === "boolean") {
                                // Switch the transformNode visibility on or off
                                transformNode.setEnabled(payload.enabled);
                            }

                            var scaling = getVector(payload, "scaling", false);
                            if (scaling) {
                                transformNode.scaling = scaling;
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
                        
                        function updateLight(payload, light) {
                            var diffuseColor = getRgbColor(payload, "diffuseColor", false);
                            if (diffuseColor) {
                                light.diffuse = diffuseColor;
                            }
                            
                            var specularColor = getRgbColor(payload, "specularColor", false);
                            if (specularColor) {
                                light.specular = specularColor;
                            }

                            if (payload.enabled !== undefined && typeof payload.enabled === "boolean") {
                                // Switch the light on or off
                                light.setEnabled(payload.enabled);
                            }
                            
                            if (payload.intensity !== undefined && !isNaN(payload.intensity)) {
                                // Dim or brighten the light
                                light.intensity = payload.intensity;
                            }
                            
                            if (payload.range !== undefined && !isNaN(payload.range)) {
                                // Set how far the light reaches.  Note: this is only available for point and spot lights.
                                light.range = payload.range;
                            }
                        }
                        
                        function updateCamera(payload, camera) {
                            if (payload.active === true) {
                                // A scene can only have 1 active camera
                                $scope.scene.activeCamera = camera;
                            }
                            
                            // The position can be set for all rotate camera types
                            if (camera.getClassName() === "ArcRotateCamera" || camera.getClassName() === "AnaglyphArcRotateCamera") {
                                var position = getVector(payload, "position", false);

                                if (position) {
                                    camera.setPosition(position);
                                }
                            }
                         
                            // The target position can be set for all camera types, except the followCamera
                            if (camera.getClassName() !== "FollowCamera") {
                                var targetPosition = getVector(payload, "targetPosition", false);

                                if (targetPosition) {
                                    camera.setTarget(targetPosition);
                                }
                            }
                        }
                        
                        function updateGuiControl(payload, control) {
                            if (typeof payload.isVisible === "boolean") {
                                control.isVisible = payload.isVisible;
                            }
                            
                            // The default horizontal alignment is "center"
                            if (payload.horizontalAlignment) {
                                switch (payload.horizontalAlignment) {
                                    case "left":
                                        control.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
                                        break;
                                    case "right":
                                        control.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
                                        break;
                                    case "center":
                                        control.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
                                        break;
                                    default:
                                        logError("The specified horizontAlignment value is not supported");
                                }
                            }
                           
                            // The default vertical alignment is "center"
                            if (payload.verticalAlignment) {
                                switch (payload.verticalAlignment) {
                                    case "top":
                                        control.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
                                        break;
                                    case "bottom":
                                        control.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
                                        break;
                                    case "center":
                                        control.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
                                        break;
                                    default:
                                        logError("The specified verticalAlignment value is not supported");
                                }
                            }

                            // The default height is 200%
                            if (!isNaN(payload.height)) {
                                control.height = payload.height + "px";
                            }
                            
                            // The default width is 200%
                            if (!isNaN(payload.width)) {
                                control.width = payload.width + "px";
                            }
                          
                            control.onValueChangedObservable.add(function(value) {
                                // Meshes, lights and camera's are all nodes (on which we can set a property value).
                                // Now we search on the target name or id.
                                var targetNodes = getNodes({name: payload.targetName, id: payload.targetId}, true);
                                       
                                targetNodes.forEach(function(targetNode) {
                                    if (targetNode.hasOwnProperty(payload.targetProperty)) {
                                        targetNode[payload.targetProperty].copyFrom(value);
                                    }
                                    else {
                                        logError("The target node doesn't has the specified target property");
                                    }                                        
                                });
                            });
                        }

                        function processCommand(payload, topic){
                            var mesh, meshes, transformNode, transformNodes, light, lights, material, materials, camera, cameras, nodes, control, controls;
                            var name = "";
                            var options = {};
                            var position, direction, alpha, beta, radius, degrees, radians, parentContainer;
                            var diffuseColor, specularColor, emissiveColor, ambientColor, gizmoColor;
                            
                            var command = payload.command.toLowerCase();
                                        
                            try {
                                switch (command.toLowerCase()) {
                                    case "create_mesh":
                                        if (!payload.type || (typeof payload.type !== "string") ) {
                                            logError("The payload should contain a meshType");
                                            return;
                                        }
                                        
                                        // TODO check if name is required
                                        if (payload.name) {
                                            name = payload.name;
                                        }
                                        
                                        if (payload.meshOptions) {
                                            // Create a shallow clone of the properties, because we will some of those properties below
                                            options = Object.assign({}, payload.meshOptions);
                                        }
                    
                                        // Convert some commonly used field (that are used in multiple mesh types)
                                        convertToRgbColor(options, "faceColors");
                                        convertToVector(options, "faceUV");
                                        convertToVector(options, "frontUVs");
                                        convertToVector(options, "backUVs");

                                        switch (payload.type) {
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
                                                convertToVector(options, "orientation");
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
                                            case "groundFromHeightMap": // TODO this doesn't work yet !!
                                                // TODO validate payload.urlToHeightMap
                                                mesh = BABYLON.MeshBuilder.CreateGroundFromHeightMap(name, payload.urlToHeightMap, options, $scope.scene);
                                                break;
                                            case "tiledGround":
                                                mesh = BABYLON.MeshBuilder.CreateTiledGround(name, options, $scope.scene);
                                                break;
                                            case "lines":
                                                convertToVector(options, "points");
                                                mesh = BABYLON.MeshBuilder.CreateLines(name, options, $scope.scene);
                                                break;
                                            case "dashedLines":
                                                convertToVector(options, "points");
                                                mesh = BABYLON.MeshBuilder.CreateDashedLines(name, options, $scope.scene);
                                                break;
                                            case "lineSystem":
                                                convertToVector(options, "lines");
                                                mesh = BABYLON.MeshBuilder.CreateLineSystem(name, options, $scope.scene);
                                                break;
                                            case "ribbon":
                                                convertToVector(options, "pathArray");
                                                mesh = BABYLON.MeshBuilder.CreateRibbon(name, options, $scope.scene);
                                                break;
                                            case "tube":
                                                convertToVector(options, "path");
                                                mesh = BABYLON.MeshBuilder.CreateTube(name, options, $scope.scene);
                                                break;
                                            case "extrusion":
                                                convertToVector(options, "shape");
                                                convertToVector(options, "path");
                                                mesh = BABYLON.MeshBuilder.ExtrudeShape(name, options, $scope.scene);
                                                break;
                                            case "customExtrusion":
                                                convertToVector(options, "shape");
                                                convertToVector(options, "path");
                                                mesh = BABYLON.MeshBuilder.ExtrudeShapeCustom(name, options, $scope.scene);
                                                break;
                                            case "lathe":
                                                convertToVector(options, "shape");
                                                mesh = BABYLON.MeshBuilder.CreateLathe(name, options, $scope.scene);
                                                break;
                                            case "polygon":
                                                convertToVector(options, "shape");
                                                convertToVector(options, "holes");
                                                // See https://github.com/BabylonJS/Babylon.js/issues/5749#issuecomment-693722120
                                                mesh = BABYLON.MeshBuilder.CreatePolygon(name, options, $scope.scene, earcut);
                                                break;
                                            case "polygonExtrusion":
                                                convertToVector(options, "shape");
                                                convertToVector(options, "holes");
                                                mesh = BABYLON.MeshBuilder.ExtrudePolygon(name, options, $scope.scene);
                                                break;                                                
                                            //case "polygonMesh":
                                            //    mesh = BABYLON.MeshBuilder.PolygonMeshBuilder(name, options, $scope.scene);
                                            //    break;      
                                            //case "polyhedron":
                                            //    mesh = BABYLON.MeshBuilder.CreatePolyhedron(name, options, $scope.scene);
                                            //    break;
                                            case "icoSphere":
                                                mesh = BABYLON.MeshBuilder.CreateIcoSphere(name, options, $scope.scene);
                                                break;
                                            default:
                                                logError("The specified command is not supported");
                                                return;
                                        }

                                        // If any properties have been specified in the message, apply those immediately to the new mesh
                                        updateMesh(payload, mesh);
                                        
                                        // Apply all the actions that have been specified in the node's config screen, to the newly created mesh
                                        $scope.config.actions.forEach(function (action, index) {
                                            applyActionToMesh(mesh, action.trigger, action.payload, action.topic);
                                        });
                                        
                                        break;
                                    case "update_mesh":
                                        meshes = getMeshes(payload, true);
                                        
                                        meshes.forEach(function (meshToUpdate) {
                                            updateMesh(payload, meshToUpdate);
                                        });
                                        break;
                                    case "remove_mesh":
                                        // No need to show a message, when the mesh is already removed
                                        meshes = getMeshes(payload, false);
                                        
                                        meshes.forEach(function (meshToDispose) {
                                            meshToDispose.dispose();
                                        });
                                        break;
                                    case "get_mesh_properties":
                                        meshes = getMeshes(payload, true);
                                        
                                        meshes.forEach(function (meshToGet) {
                                            sendMeshProperties(meshToGet);
                                        });
                                        break;
                                    case "create_transform_node":
                                        if (!payload.name || payload.name == "") {
                                            logError("The payload should contain a transform node 'name'");
                                            return;
                                        }

                                        name = payload.name;
                                        tranformNode = new BABYLON.TransformNode(name); 

                                        // If any properties have been specified in the message, apply those immediately to the new mesh
                                        updateTransformNode(payload, tranformNode);
                                        break;
                                    case "update_transform_node":
                                        transformNodes = getTransformNodes(payload, true);
                                    
                                        transformNodes.forEach(function (transformNodeToUpdate) {
                                            updateTransformNode(payload, transformNodeToUpdate);
                                        });
                                        break;
                                    case "remove_transform_node":
                                        // No need to show a message, when the tranform node is already removed
                                        transformNodes = getTransformNodes(payload, false);
                                    
                                        transformNodes.forEach(function (transformNodeToDispose) {
                                            transformNodeToDispose.dispose();
                                        });
                                        break;
                                    case "create_light":
                                        if (!payload.type || (typeof payload.type !== "string") ) {
                                            logError("The payload should contain a light 'type'");
                                            return;
                                        }
                                        
                                        if (payload.name) {
                                            lightName = payload.name;
                                        }
                                        
                                        /*TODOif (light) {
                                            // If a light already exist with the same name or id, then remove it
                                            light.dispose();
                                        }*/

                                        switch (payload.type) {
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
                                        
                                        if (light) {
                                            updateLight(payload, light);
                                        }
                                        break;
                                    case "update_light":    
                                        lights = getLights(payload, true);
                                        
                                        lights.forEach(function (lightToUpdate) {
                                            updateLight(payload, lightToUpdate);
                                        });
                                        break;
                                    case "remove_light":
                                        // No need to show a message, when the mesh is already removed
                                        lights = getLights(payload, false);
                                        
                                        lights.forEach(function (lightToRemove) {
                                            lightToRemove.dispose();
                                        });
                                        break;
                                    case "get_light_properties":
                                        lights = getLights(payload, true);
                                        
                                        lights.forEach(function (lightToGet) {
                                            sendLightProperties(lightToGet);
                                        });
                                        break;
                                    case "create_material":
                                        if (!payload.name) {
                                            logError("The payload should contain a 'materialName'");
                                            return;
                                        }

                                        // Create a new material with the specified name
                                        material = new BABYLON.StandardMaterial(payload.name, $scope.scene);
                                        
                                        // Update the material with settings from the input message
                                        updateMaterial(payload, material);
                                        
                                        // When an (optional) mesh name/id is specified, then apply the material immediately to that mesh
                                        meshes = getMeshes({name: payload.targetName, id: payload.targetId}, false);
                                        meshes.forEach(function (meshToUpdate) {
                                            meshToUpdate.material = material;
                                        });
                                        break;
                                    case "update_material":
                                        materials = getMaterials(payload, true);

                                        materials.forEach(function (materialToUpdate) {
                                            // Update the material with settings from the input message
                                            updateMaterial(payload, materialToUpdate);
                                            
                                            // When an (optional) mesh name/id is specified, then apply the material immediately to that mesh
                                            meshes = getMeshes(payload, false);
                                            meshes.forEach(function (meshToUpdate) {
                                                meshToUpdate.material = materialToUpdate;
                                            });
                                        });
                                        break;
                                    case "apply_mesh_material":
                                        meshes = getMeshes({name: payload.targetName, id: payload.targetId}, true);
                                        
                                        if (meshes.length > 0) {
                                            materials = getMaterials(payload, true);
                                            
                                            if (materials.length > 1) {
                                                logError("Multiple materials found, but only first one can be applied");
                                            }
                                            
                                            if (materials.length > 0) {
                                                material = materials[0];
                                            
                                                meshes.forEach(function (meshToUpdate) {
                                                    meshToUpdate.material = material;
                                                });
                                            }
                                        }
                                        break;
                                    case "update_mesh_material":
                                        meshes = getMeshes(payload, true);
                                        
                                        meshes.forEach(function (meshToUpdate) {
                                            if (meshToUpdate.material) {
                                                // Update the mesh material with settings from the input message
                                                updateMaterial(payload, meshToUpdate.material);
                                            }
                                            else {
                                                logError("The mesh (with name '" + meshToUpdate.name + "') has no material to update");
                                            }
                                        });
                                        break;
                                    case "add_mesh_action":
                                        if (!payload.actionTrigger || payload.actionTrigger === "" || (typeof payload.actionTrigger !== "string")) {
                                            logError("The payload should contain an actionTrigger");
                                            return;
                                        }

                                        meshes = getMeshes(payload, true);
                                        
                                        meshes.forEach(function (meshForAction) {
                                            applyActionToMesh(meshForAction, payload.actionTrigger, payload.payloadToSend, payload.topicToSend);
                                        });
                                        break;
                                    case "add_scene_action":
                                        if (!payload.actionTrigger || payload.actionTrigger === "" || (typeof payload.actionTrigger !== "string")) {
                                            logError("The payload should contain an actionTrigger");
                                            return;
                                        }
                                        
                                        applyActionToScene(payload.actionTrigger, payload.payloadToSend, payload.topicToSend);
                                        break;
                                    case "create_animation":
                                        var startTime, endTime;
                                        var propertyType = payload.propertyType.toUpperCase();
                                        var loopMode = payload.loopMode.toUpperCase();
                                        
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
                                                logError("The specified property type is not supported");
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
                                                logError("The specified loop mode is not supported");
                                                return;
                                        }

                                        if (payload.keyFrames && Array.isArray(payload.keyFrames) && payload.keyFrames.length > 0) {
                                            // Convert the 'time' fields (in seconds) to 'frame' fields
                                            payload.keyFrames.forEach(function (keyFrame) {
                                                // The 'time' field overrules a 'frame' field, if both fields have been specified
                                                if (keyFrame.time != undefined) {
                                                    keyFrame.frame = keyFrame.time * payload.frameRate;
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
                                                        logError("The specified property type is not supported");
                                                        return;
                                                }
                                            });
                                        }
                                        else {
                                            logError("No key frames have been specified for the animation");
                                            return;
                                        }
                                        
                                        // A startTime overrules the startFrame, when both fields have been specified
                                        if(payload.startTime != undefined && payload.frameRate != undefined) {
                                            // Convert the start time (in seconds) to the start frame
                                            startFrame = payload.startTime * payload.frameRate;
                                        }
                                        
                                        // An endTime overrules the endFrame, when both fields have been specified
                                        if(endTime != undefined && payload.frameRate != undefined) {
                                            // Convert the start time (in seconds) to the start frame
                                            endFrame = endTime * payload.frameRate;
                                        }
                                        
                                        var meshes = getMeshes({name: payload.targetName, id: payload.targetId}, true);

                                        meshes.forEach(function (meshToAnimate) {
                                            var propertyExists = checkPropertyExists(meshToAnimate, payload.targetProperty);
                                            
                                            if (propertyExists) {
                                                var animation = new BABYLON.Animation(payload.name, payload.targetProperty, payload.frameRate, propertyType, loopMode);

                                                animation.setKeys(payload.keyFrames);

                                                meshToAnimate.animations.push(animation);
                                                
                                                if (payload.autoStart) {
                                                    $scope.scene.beginAnimation(meshToAnimate, payload.startFrame, payload.endFrame, payload.loop);
                                                }
                                            }
                                            else {
                                                logError("The property cannot be animated, since it doesn't exist in the target mesh");
                                            }
                                        });
                                        break;
                                    case "start_animation":
                                    case "restart_animation":
                                    case "pause_animation":
                                    case "stop_animation":
                                    case "reset_animation":
                                        // Meshes, lights and camera's are all nodes (which can have animations).  So create 1 array of nodes.
                                        nodes = getNodes({name: payload.targetName, id: payload.targetId}, true);
                                       
                                        nodes.forEach(function(node) {
                                            // As soon as an Animation is started (not created!), an animatable instance will be created in the scene.
                                            // The animatable instance stores the actual running animation instance(s) of 1 node (i.e. mesh, light, camera).
                                            // When the animation has not been started yet at this point, there will be no animatable yet!
                                            var animatable = $scope.scene.getAnimatableByTarget(node);

                                            //
                                            switch (command) {
                                                case "start_animation":
                                                    if (payload.startFrame == undefined || isNaN(payload.startFrame)) {
                                                        logError("No startFrame number available in the message");
                                                    }
                                                    else if (payload.endFrame == undefined || isNaN(payload.endFrame)) {
                                                        logError("No endFrame number available in the message");
                                                    }
                                                    else {
                                                        // Since there is no animatable yet, this means the animation has not been started yet.
                                                        // Which means that the animations on the node need to be started for the first time.
                                                        // P.S. when payload.loop is not available, then we consider it as 'false'
                                                        $scope.scene.beginAnimation(node, payload.startFrame, payload.endFrame, payload.loop);
                                                    }
                                                    break;
                                                case "restart_animation":
                                                    if (animatable) {
                                                        // Restart all the runtime animations (of the node) available in the animatable
                                                        animatable.restart();
                                                    }
                                                    else {
                                                        logError("No animatables available for the specified node, so no animations that are current paused");
                                                    }
                                                    break;
                                                case "pause_animation":
                                                    if (animatable) {
                                                        animatable.pause();
                                                    }
                                                    break;
                                                case "stop_animation":
                                                    if (animatable) {
                                                        // Stop all the runtime animations (of the node) available in the animatable.
                                                        // When an animation is stopped, the runtime animation instance will also be removed.
                                                        // And then related animatable instance will also be removed.
                                                        animatable.stop();
                                                    }
                                                    break;
                                                case "reset_animation":
                                                    if (animatable) {
                                                        // Reset (to the original property value) all the runtime animations (of the node) available in the animatable
                                                        animatable.reset();
                                                    }
                                                    break;
                                            }
                                        });
                                        break;
                                    case "create_camera":
                                        if (!payload.type || (typeof payload.type !== "string") ) {
                                            logError("The payload should contain a camera type");
                                            return;
                                        }
                                        
                                        // TODO check if name is required
                                        if (payload.name) {
                                            name = payload.name;
                                        }
                                        
                                        // The position is required for all camera types, except the followCamera
                                        if (payload.type !== "followCamera") {
                                            position = getVector(payload, "position", true);
                                            
                                            if (!position) {
                                                return;
                                            }
                                        }

                                        switch (payload.type) {
                                            case "universal":
                                                camera = new BABYLON.UniversalCamera(name, position, $scope.scene);
                                                break;
                                            case "arcRotate":
                                                // The 3 parameters after the name (i.e. alpha, beta, radius will be overwritten be our position vector.
                                                // This way we avoid that users need to calculate the angles themselves...
                                                // Pass (0,0,0) as target vector, since the target vector will be update at the end of this function anyway.
                                                // The position will be set further on, in the updateCamera function
                                                camera = new BABYLON.ArcRotateCamera(name, 0, 0, 0, BABYLON.Vector3(0, 0, 0), $scope.scene);
                                                break;
                                            case "follow":
                                                meshes = getMeshes({name: payload.targetName, id: payload.targetId}, true);
                                        
                                                if (meshes.length === 0) {
                                                    return;
                                                }
                                                
                                                if (meshes.length > 1) {
                                                    logError("Multiple target meshes have been found, so the camera will follow the first mesh");
                                                }

                                                camera = new BABYLON.FollowCamera(name, position, $scope.scene);
                                                
                                                // Let the camera follow the first found mesh                                           
                                                camera.lockedTarget = meshes[0];
                                                
                                                if (payload.radius && !isNaN(payload.radius)) {
                                                    // The goal distance between the camera and the target
                                                    camera.radius = payload.radius;
                                                }
                                                
                                                if (payload.heightOffset && !isNaN(payload.heightOffset)) {
                                                    // The goal height of the camera above the local origin (centre) of target
                                                    camera.heightOffset = payload.heightOffset;
                                                }
                                                
                                                if (payload.rotationOffset && !isNaN(payload.rotationOffset)) {
                                                    // The goal rotation of the camera around the local origin (centre) of the target in the x y plane
                                                    camera.rotationOffset = payload.rotationOffset;
                                                }
                                                
                                                if (payload.cameraAcceleration && !isNaN(payload.cameraAcceleration)) {
                                                    // Acceleration of the camera in moving from current to the goal position
                                                    camera.cameraAcceleration = payload.cameraAcceleration;
                                                }
                                                
                                                if (payload.maxCameraSpeed && !isNaN(payload.maxCameraSpeed)) {
                                                    // The speed at which acceleration is halted
                                                    camera.maxCameraSpeed = payload.maxCameraSpeed;
                                                }
                                                break;
                                            case "anaglyphUniversal":
                                                camera = new BABYLON.AnaglyphUniversalCamera(name, position, payload.eyeSpace, $scope.scene);
                                                break;
                                            case "anaglypArcRotate":
                                                // The 3 parameters after the name (i.e. alpha, beta, radius) will be overwritten be our position vector.
                                                // This way we avoid that users need to calculate the angles themselves...
                                                // Pass (0,0,0) as target vector, since the target vector will be update at the end of this function anyway.
                                                // The position will be set further on, in the updateCamera function
                                                camera = new BABYLON.AnaglyphArcRotateCamera(name, 0, 0, 0, BABYLON.Vector3(0, 0, 0), payload.eyeSpace, $scope.scene);
                                                break;
                                            case "deviceOrientation":
                                                targetPosition = getVector(payload, "targetPosition", true);
                                                if (!targetPosition) {
                                                    return;
                                                }
                                                
                                                camera = new BABYLON.DeviceOrientationCamera(name, position, $scope.scene);

                                                if (payload.angularSensibility && !isNaN(payload.angularSensibility)) {
                                                    // Set the sensitivity of the camera for rotation
                                                    camera.angularSensibility = payload.angularSensibility;
                                                }
                                                
                                                if (payload.moveSensibility && !isNaN(payload.moveSensibility)) {
                                                    // Set the sensitivity of the camera for movement
                                                    camera.moveSensibility = payload.moveSensibility;
                                                }
                                                break;
                                        }

                                        updateCamera(payload, camera);
                                        
                                        camera.attachControl($scope.canvas, true);
                                        break;
                                    case "update_camera":
                                        cameras = getCameras(payload, true);
                                        
                                        cameras.forEach(function (cameraToGet) {
                                            updateCamera(payload, cameraToGet);
                                        });
                                        break;
                                    case "get_camera_properties":
                                        cameras = getCameras(payload, true);
                                        
                                        cameras.forEach(function (cameraToGet) {
                                            sendCameraProperties(cameraToGet);
                                        });
                                        break;
                                    case "update_axes":
                                        if (payload.showAxes == undefined) {
                                            logError("The payload should contain a showAxes boolean field");
                                            return;
                                        }
                                        
                                        if ($scope.axesViewer) {
                                            // Hide the current axes
                                            $scope.axesViewer.dispose();
                                            $scope.axesViewer = null;
                                        }
                                            
                                        if (payload.showAxes === true) {
                                            $scope.axesViewer = new BABYLON.Debug.AxesViewer($scope.scene, payload.scaleLines);
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
                                                        
                                                        sendMeshProperties(pickedMesh);
                                                    }
                                                    else {
                                                        pickedMesh.renderOutline = false;
                                                    }
                                                }
                                            };
                                        }
                                        break;
                                    case "stop_selection_mode":
                                        if ($scope.previousPick) {
                                            $scope.previousPick.renderOutline = false;
                                        }
                                                
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
                                    case "add_glow_layer":
                                        var glowLayer = new BABYLON.GlowLayer("glow", $scope.scene);
                                        
                                        if (payload.intensity !== undefined && !isNaN(payload.intensity)) {
                                            // Control the intensity of the color in the glow layer
                                            glowLayer.intensity = payload.intensity;
                                        }
                                        break;
                                    case "create_gui_control":
                                        if (!$scope.fullScreenUI) {
                                            // Lazy creation of the GUI layer, only when needed
                                            $scope.fullScreenUI = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
                                        }

                                        // Create a gui control of the specified type
                                        switch(payload.type) {
                                            case "stackPanel":
                                                control = new BABYLON.GUI.StackPanel();
                                                
                                                if (payload.isVertical == true) {
                                                    control.isVertical = true;
                                                }
                                                break;
                                            case "textBlock":
                                                control = new BABYLON.GUI.TextBlock();
                                                control.text = payload.defaultValue || "";
                                                break;    
                                            case "colorPicker":
                                                control = new BABYLON.GUI.ColorPicker();
                                                //control.value = skullMaterial.diffuseColor; // TODO
                                                break;
                                            default:
                                                logError("The specified horizontAlignment value is not supported");
                                        }
                                        
                                        if (control) {
                                            updateGuiControl(payload, control);
                                            
                                            // Try to get the parent container control
                                            parentContainer = getGuiControls({controlName: payload.parentName}, false);
                                            
                                            if (parentContainer.length > 0) {
                                                parentContainer[0].addControl(control);
                                            }
                                            else {
                                                // Na parent control (e.g. StackPanel) has been specified, so add the control directly to the GUI layer
                                                $scope.fullScreenUI.addControl(control);
                                            }
                                        }
                                        break;
                                    case "update_gui_control":
                                        controls = getGuiControls(payload, true);

                                        controls.forEach(function (controlToUpdate) {
                                            updateGuiControl(payload, controlToUpdate);
                                        });
                                        break;
                                    case "remove_gui_control":
                                        controls = getGuiControls(payload, true);

                                        controls.forEach(function (controlToRemove) {
                                            // TODO where to get container?  Is a custom prototype function required??
                                            parentContainer.removeControl(control);
                                        });
                                        break;
                                    case "add_gizmo":
                                        if (!payload.type || (typeof payload.type !== "string") ) {
                                            logError("The payload should contain a camera type");
                                            return;
                                        }
                                        
                                        if (!$scope.utilityLayer) {
                                            // Create a single utility layer (for performance), where the gizmos will be rendered on.
                                            // We reuse this layer, since every new utility layer comes with additional overhead.
                                            $scope.utilityLayer = new BABYLON.UtilityLayerRenderer($scope.scene);
                                        }
                                        
                                        meshes = getMeshes(payload, true);
                                        
                                        if (meshes.length === 0) {
                                            return;
                                        }
                                        
                                        if (meshes.length === 0) {
                                            return;
                                        }
                                        
                                        if (meshes.length > 1) {
                                            logError("Multiple meshes found, but only the first will get a gizmo");
                                        }
                                        
                                        // When a previous gizmo is available, then remove it to make sure that only one mesh has a gizmo
                                        if ($scope.currentGizmo) {
                                            $scope.currentGizmo.attachedMesh = null; // Hide the current gizmo
                                            $scope.currentGizmo.dispose();
                                            $scope.currentGizmo = null;
                                        }
                                            
                                        switch (payload.type) {
                                            case "axisDrag":
                                                var direction = getVector(payload, "direction", true); // E.g. (1,0,0)
                            
                                                if (direction) {
                                                    gizmoColor = getRgbColor(payload, "outlineColor", false);
                                                    $scope.currentGizmo = new BABYLON.AxisDragGizmo(direction, gizmoColor, $scope.utilityLayer);
                                                }
                                                break;
                                            case "axisScale":
                                                var direction = getVector(payload, "direction", true); // E.g. (1,0,0)
                            
                                                if (direction) {
                                                    gizmoColor = getRgbColor(payload, "outlineColor", false);
                                                    $scope.currentGizmo = new BABYLON.AxisScaleGizmo(direction, gizmoColor, $scope.utilityLayer);
                                                }
                                                break;
                                            case "planeRotation":
                                                var direction = getVector(payload, "direction", true); // E.g. (1,0,0)
                            
                                                if (direction) {
                                                    gizmoColor = getRgbColor(payload, "outlineColor", false);
                                                    $scope.currentGizmo = new BABYLON.PlaneRotationGizmo(direction, gizmoColor, $scope.utilityLayer);
                                                }
                                                break;
                                            case "position":
                                                $scope.currentGizmo = new BABYLON.PositionGizmo($scope.utilityLayer);
                                                break;
                                            case "scale":
                                                $scope.currentGizmo = new BABYLON.ScaleGizmo($scope.utilityLayer);
                                                break;
                                            case "rotation":
                                                $scope.currentGizmo = new BABYLON.RotationGizmo($scope.utilityLayer);
                                                break;
                                            case "boundingBox":
                                                $scope.currentGizmo = new BABYLON.BoundingBoxGizmo();
                                                break;
                                            default:
                                                logError("Unsupported gizmo type '" + payload.type + "'");
                                        }
                                        
                                        if (!$scope.currentGizmo) {
                                            return;
                                        }   
    
                                        // Apply the gizmo to the first mesh found
                                        $scope.currentGizmo.attachedMesh = meshes[0];

                                        // Keep the gizmo fixed to world rotation
                                        $scope.currentGizmo.updateGizmoRotationToMatchAttachedMesh = false;
                                        $scope.currentGizmo.updateGizmoPositionToMatchAttachedMesh = true;
                                        break;
                                    case "remove_gizmo":
                                        // When a previous gizmo is available, then remove it to make sure that only one mesh has a gizmo
                                        if ($scope.currentGizmo) {
                                            $scope.currentGizmo.attachedMesh = null; // Hide the current gizmo
                                            $scope.currentGizmo.dispose();
                                            $scope.currentGizmo = null;
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
                            }
                            
                            $scope.scene = scene;
                            
                            if(!Array.isArray($scope.config.startupCommands)){
                                $scope.config.startupCommands = [$scope.config.startupCommands];
                            }
                            
                            var startupCommands = [];

                            try {
                                startupCommands = JSON.parse($scope.config.startupCommands);
                            }
                            catch(err) {
                                logError("The 'startup' parameter in the config screen does not contain valid JSON data.");
                            }
                            
                            startupCommands.forEach(function(val,idx){
                                if(typeof val != "object" || !val.command) {
                                    logError("The 'startup' parameter in the config screen should contain an object (or an array of objects) which have a 'command' property.");
                                }
                                else {   
                                    processCommand(val);
                                }
                            })
                            
                            // Make sure there is always a (arc rotate) camera available, to avoid "Uncaught Error: No camera defined".
                            // When alwaysDefaultCam is true, the existing active camera (when already available in the scene) will become inactive.
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
                                if ($scope.engine) {
                                    $scope.engine.resize();
                                }
                            }, 100);

                            // Apply all the actions that have been specified in the node's config screen, to the scene and the loaded meshes
                            $scope.config.actions.forEach(function (action, index) {
                                if (action.selectorType === "scene") {
                                    applyActionToScene(action.trigger, action.payload, action.topic);
                                }
                                else {
                                    var payload = {};
                                    
                                    // Construct a virtual payload with the correct fields
                                    switch (action.selectorType) {
                                        case "meshTag":
                                            payload.tag = action.selector;
                                            break;
                                        case "meshName":
                                        case "json": // Array of mesh names
                                            payload.name = action.selector;
                                            break;
                                        case "meshId":
                                            payload.id = action.selector;
                                            break;
                                    }
                                    
                                    var meshes = getMeshes(payload, true);
                                        
                                    meshes.forEach(function(meshForAction) {
                                        applyActionToMesh(meshForAction, action.trigger, action.payload, action.topic);
                                    });
                                }
                            });
                        }
                        
                        $scope.init = function (config) {
                            $scope.config = config;
                            
                            // Add support to BabylonJs to allow GUI controls to be searched by name
                            // See https://playground.babylonjs.com/#HETZDX#4
                            BABYLON.GUI.AdvancedDynamicTexture.prototype.executeOnAllControls = function (func, container) {
                                if (!container) {
                                    container = this._rootContainer;
                                }
                                for (var _i = 0, _a = container.children; _i < _a.length; _i++) {
                                    var child = _a[_i];
                                    if (child.children) {
                                        this.executeOnAllControls(func, child);
                                        continue;
                                    }
                                    func(child);
                                }
                            };

                            BABYLON.GUI.AdvancedDynamicTexture.prototype.getControlByName = function (name) {
                                var foundControl = null;
                                if (name) {
                                    this.executeOnAllControls(function(control) {
                                        if(control.name && control.name === name){
                                            foundControl = control;
                                        }
                                    }, this._rootContainer);
                                }
                                return foundControl;
                            };
                            
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
                                    
                                    // Don't add this simply as a prefix for the filename!
                                    // Because then all other files (e.g. texture file called from the gltf file) will be loaded
                                    // without that prefix.  Instead we set the base url, which is applied by BabylonJs to all the urls.
                                    BABYLON.Tools.BaseUrl = "ui_babylonjs/" + $scope.config.id + "/scene/";

                                    BABYLON.SceneLoader.Load("", $scope.config.filename, $scope.engine,
                                    /*onSuccess*/function (newScene) {
                                        setupScene(newScene);
                                    },
                                    /*onProgress*/function (event) {
                                    },
                                    /*onError*/function (scene, message, exception) {
                                        logError("Unable to load the file into the scene");
                                        // Unable to load the scene file from the server, so start with a new scene from scratch
                                        setupScene(null);
                                    });
                                }
                                else {
                                    // No scene filename has been specified, so start with a new scene from scratch
                                    setupScene(null);
                                }
                            }, 200);
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
                    case "babylon_gui.js":
                        res.sendFile(babylonJsGuiPath);
                        break;                        
                    case "pep.js":
                        res.sendFile(pepJsPath);
                        break;
                    case "earcut.js":
                        res.sendFile(earcutPath);
                        break;
                    default:
                        logError("Unknown resource " + req.params[0]);
                        res.status(404).json('Unknown resource');                
                }
                break;
            case "scene":
                var node = RED.nodes.getNode(req.params.nodeid);
                
                if (!node) {
                    logError("Unknown node with id " + req.params.nodeid);
                    res.status(404).json('Unknown node id');
                    return;
                }

                if (!node.folder || node.folder === "") {
                    logError("No folder is specified in node with id " + req.params.nodeid);
                    res.status(404).json('No folder');
                    return;
                }
                    
                if (!node.folder || node.folder === "") {
                    logError("No folder is specified in node with id " + req.params.nodeid);
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
                        logError("The path (" + fullPath + ") is a directory instead of a file");
                        res.status(404).json('Directory instead of file');
                        return;
                    }
                }
                
                if (!fs.existsSync(fullPath)) {
                    logError("The file (" + fullPath + ") does not exist");
                    res.status(404).json('Unexisting file');
                    return;
                }

                // Search the requested file in the specified folder, and return it to the requestor
                res.sendFile(fullPath);
                break;
            default:
                logError("The category (" + req.params.category + ") in the url is not supported");
                res.status(404).json('Unknown category');
        }
    });
}
