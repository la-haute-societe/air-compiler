// Include stuff
var path = require("path");
var fs = require("fs");
var os = require('os');
var _ = require("underscore");
var cli = require("./cli.js");


/**
 * CONSTANTS
 */

// Available compilation targets in config file
var AVAILABLE_COMPILATION_TARGETS = [
	"ios",
	"android",
	"air",
	"windows",
	"mac"
];

// Available compilation targets for iOS
var IOS_COMPILE_TARGETS = {
	debug: {
		interpreter: "ipa-debug-interpreter",
		test: "ipa-debug",
		adhoc: "ipa-ad-hoc",
		appstore: "ipa-app-store"
	},
	release: {
		interpreter: "ipa-test-interpreter",
		test: "ipa-test",
		adhoc: "ipa-ad-hoc",
		appstore: "ipa-app-store"
	}
};

// Available compilation targets for Android
var ANDROID_COMPILE_TARGETS = {
	debug: "apk-debug",
	release: "apk"
};

// Default values for multiple type config parameters
var DEFAULT_VALUES = {
	simulation_profile: 'mobileDevice',
	ios_package: 'test',
	windows_package: 'bundle'
};

// Get binary extension for specific target
var EXTENSIONS_BY_TARGETS = {
	ios: "ipa",
	android: "apk",
	air: "air",
	windows: "exe",
	mac: "dmg"
};


/**
 * PRIVATE
 */

// The config manager
var _configManager;

// The command builder
var _commandBuilder;

// App descriptor data
var _descriptorData;

// Current version and used extensions
var _currentVersionNumber;
var _currentMajorVersionNumber;
var _currentExtensions;

// Main SWF content, app ID and app name from app descriptor
var _swfContent;
var _appID;
var _appName;

// Local IP address for debugging
var _ipForDebugging;

// Sub compiling stored process to do sub compiling process in order
var _subCompilingProcesses = [];

// Link to the JSON file where successfully compiled binaries path are stored to deploy on devices
var _compiledBinariesFilePath = "tmp/compiled.json";

/**
 * PUBLIC
 */
var that = {

	/********************************************************************************************
	 * 									       INITIALISATION
	 ********************************************************************************************/
	init: function (pConfigManager, pCommandBuilder)
	{
		// Store the config manager and the command builder dependences
		_configManager = pConfigManager;
		_commandBuilder = pCommandBuilder;

		// Patch the compiled binaries file path to be project relative
		_compiledBinariesFilePath = path.resolve(_configManager.getProjectDirectoryPath() + _compiledBinariesFilePath);
	},

	/**
	 * Execute compiler.
	 * Simulation / compiling dispatch.
	 */
	execute: function ()
	{
		// Get the compiling mode from the config
		var compilingMode = _configManager.getCompilingMode();

		// Check compiling mode
		// And execute submethod with config node in parameter
		if (compilingMode == "simulate")
		{
			that.simulate(
				_configManager.getSimulationConfigNodeForProfile()
			);
		}
		else if (compilingMode == "compile")
		{
			that.compile(
				_configManager.getCompilingConfigNodeForProfile()
			);
		}
		
		// Just push to devices
		else if (compilingMode == "push")
		{
			that.pushToDevices();
		}
	},


	/********************************************************************************************
	 * 									      XML DESCRIPTOR
	 ********************************************************************************************/

	/**
	 * Get incremented version number of the application from the XML descriptor
	 */
	getDescriptorData: function (pIncrementVersion)
	{
		// Path to the base descriptor
		var descriptorPath = path.resolve(_configManager.getProjectDirectoryPath() + "/" + _configManager.getDescriptorLink());

		// Get app descriptor file
		_descriptorData = fs.readFileSync(descriptorPath).toString();

		// Get version number and used extensions
		_currentVersionNumber = that.getXMLTagValue(_descriptorData, "versionNumber");
		_currentExtensions = that.getXMLTagValue(_descriptorData, "extensions");

		// Get the SWF content name
		_swfContent = that.getXMLTagValue(_descriptorData, "content");

		// Get the app name
		_appName = that.getXMLTagValue(_descriptorData, "filename");

		// Get the app id
		_appID = that.getXMLTagValue(_descriptorData, "id");

		// Auto increment app version
		if (pIncrementVersion)
		{
			// Split version parts
			var versionSplit = _currentVersionNumber.split(".");

			// Detect bad formated version number
			if (versionSplit.length != 3)
			{
				throw new Error("Version number need to be X.X.X formated.");
				return;
			}

			// Increment compile number
			versionSplit[2] = parseInt(versionSplit[2], 10) + 1;

			// Detect maximum compile number
			if (versionSplit[2] > 999)
			{
				// Increment subversion number
				versionSplit[1] = parseInt(versionSplit[1], 10) + 1;
			}

			// Get the current version back to its originial form
			_currentVersionNumber = versionSplit.join(".");

			// Replace version
			_descriptorData = that.setXMLTagValue(_descriptorData, {
				versionNumber: _currentVersionNumber
			});

			// Save the file
			fs.writeFileSync(
				path.resolve(_configManager.getProjectDirectoryPath() + "/" + _configManager.getDescriptorLink()),
				_descriptorData
			);

			// Show version status
			cli.notice("App version incremented to " + _currentVersionNumber);
		}
		else
		{
			// Show version status
			cli.notice("Current app version " + _currentVersionNumber + " (not incremented).");
		}

		// Get the major version without compile number for the binary filename
		_currentMajorVersionNumber = _currentVersionNumber.substring(0, _currentVersionNumber.lastIndexOf("."));
	},

	/**
	 * Get XML tag value, dirty way
	 */
	getXMLTagValue: function (pXMLData, pTagName)
	{
		// Get string indexes from XML
		var firstIndex = pXMLData.indexOf("<" + pTagName + ">") + pTagName.length + 2;
		var endIndex = pXMLData.indexOf("</" + pTagName + ">");

		return (
			// If we got proper indexes
			firstIndex != -1 && endIndex != -1

			// Get the tag value
			? pXMLData.substring(firstIndex, endIndex)

			// Not found
			: null
		);
	},

	/**
	 * Set XML tag value, dirty way
	 */
	setXMLTagValue: function (pXMLData, pTags)
	{
		// String indexes and parts
		var firstIndex,
			lastIndex,
			firstPart,
			lastPart;

		// Browse every values to replace
		for (var i in pTags)
		{
			// If we got a value and not just a key
			if (pTags[i] != null)
			{
				// Get string indexes from XML
				firstIndex = pXMLData.indexOf("<" + i + ">") + i.length + 2;
				endIndex = pXMLData.indexOf("</" + i + ">");

				// If our indexes are ok
				if (firstIndex != -1 && endIndex != -1)
				{
					// Cut the first and last part of the XML around the value to replace
					firstPart = pXMLData.substring(0, firstIndex);
					lastPart = pXMLData.substring(endIndex, pXMLData.length);

					// Join parts around new XML value
					pXMLData = firstPart + pTags[i] + lastPart;
				}
			}
		}

		// Return the new XML
		return pXMLData;
	},

	/********************************************************************************************
	 * 									         LOGS
	 ********************************************************************************************/

	/**
	 * Get all successfully compiled binaries paths
	 */
	getCompiledBinariesPaths: function ()
	{
		// The object containing compiled paths
		// Read it or if it doesn't exists yet, create it
		return fs.existsSync(_compiledBinariesFilePath) ? JSON.parse(fs.readFileSync(_compiledBinariesFilePath)) : {};
	},

	/**
	 * Store a successfully compiled binary path to the deploy to devices method
	 */
	addCompiledBinaryPath: function (pTargetName, pOutputPath)
	{
		// Get the compiled paths and compile profile
		var compiledBinaries = that.getCompiledBinariesPaths();
		var compilingProfile = _configManager.getCompilingProfile();

		// If this profile is not yet included
		if (!(compilingProfile in compiledBinaries))
		{
			compiledBinaries[compilingProfile] = {};
		}

		// Include the path to this binary
		compiledBinaries[compilingProfile][pTargetName] = pOutputPath;
		
		// Include timestamp to now which one is the most recent
		compiledBinaries[compilingProfile]["_timestamp"] = (new Date()).getTime();

		// Save the file
		fs.writeFileSync(_compiledBinariesFilePath, JSON.stringify(compiledBinaries));
	},

	/********************************************************************************************
	 * 									        SIMULATION
	 ********************************************************************************************/
	simulate: function (pConfigNode)
	{
		cli.notice("Running simulation profile '" + _configManager.getCompilingProfile() + "' (ctrl + c to kill simulatior)");

		// Defaults parameters for this config node
		var configNode = _.defaults(pConfigNode, {
			resolution: '',
			profile: '',
			density: 0,
			platform: '',
			aneDirectory: _configManager.getConfigData().aneDirectory,
			atlogin: false,
			arguments: []
		});

		// Build parameters
		var buildParameters = [];

		// Check if we have a specific resolution to check on mobile
		if (configNode.resolution != "")
		{
			// Force mobile mode
			buildParameters.push("-profile " + DEFAULT_VALUES.simulation_profile);

			// Add the parameter
			buildParameters.push("-screensize " + configNode.resolution);
		}
		else if (configNode.profile != '')
		{
			// Custom profile
			buildParameters.push("-profile " + configNode.profile);
		}

		// Check if we have a specific density (non documented by Adobe)
		if (configNode.density > 0)
		{
			// Add the parameter
			buildParameters.push("-XscreenDPI " + configNode.density);
		}

		// Check if we have a specific platform (non documented by Adobe)
		if (configNode.platform != '')
		{
			// Validate accepted platform
			if (configNode.platform.toLowerCase() == "ios")
			{
				configNode.platform = "IOS";
			}
			else if (configNode.platform.toLowerCase() == "android")
			{
				configNode.platform = "AND";
			}
			else
			{
				return cli.fatal("Invalid platform for simulation process.", 3);
			}

			// Add the parameter
			buildParameters.push("-XversionPlatform " + configNode.platform);
		}

		// Add native extensions folder
		if (configNode.aneDirectory != '')
		{
			buildParameters.push("-extdir " + configNode.aneDirectory);
		}

		// Lauching simulator with fake auto startup invoke event
		if (configNode.atLogin)
		{
			buildParameters.push("-atlogin");
		}

		// Add app descriptor XML link
		buildParameters.push(_configManager.getConfigData().appDescriptor);
		buildParameters.push(_configManager.getConfigData().appDirectory);

		// Check if we have launching arguments associated to the invoke event
		if (configNode.arguments.length > 0)
		{
			buildParameters.push("--");
			buildParameters = buildParameters.concat(configNode.arguments);
		}

		// Call the ADL from the SDK
		_commandBuilder.execute("adl", buildParameters, function (error, stdout, stderr, command)
		{
			// Check error
			if (error != null)
			{
				// Show the last used command
				cli.br();
				cli.error("-> Error while launching simulator.");
				cli.br();
				cli.warning("Last command :");
				cli.notice(command);

				// Additionnal information
				cli.br();
				cli.warning("Error :");
				if (stdout != "") cli.notice(stdout);
				if (stderr != "") cli.notice(stderr);

				// Let the user see the message
				cli.promptExit(3);
			}
			else
			{
				// No errors
				cli.success("Simulator closed without error.");
			}
		});
	},

	/********************************************************************************************
	 * 										    COMPILING
	 ********************************************************************************************/
	compile: function (pConfigNode)
	{
		cli.notice("Running compiling profile '" + _configManager.getCompilingProfile() + "'");

		// Defaults parameters for this config node
		var configNode = _.defaults(pConfigNode, {
			debug: false,
			sampling: false,
			hideAneLib: false,
			extensions: [],
			autoInstall: true,
			autoIncrement: true
		});

		// If debug is activated, get IP
		if (configNode.debug != null && configNode.debug != "")
		{
			// Get debugging IP from config
			var debuggingIP = _configManager.getConfigData().debuggingIP;

			// Check if a specific IP for debugging is in the config
			if (debuggingIP != null && debuggingIP != "")
			{
				// Save IP for debugging
				_ipForDebugging = debuggingIP;

				cli.notice("Selected IP for debugging from config : " + _configData.debuggingIP);
			}
			else
			{
				// Selected IPs
				var selectedAddresses = [];

				// Check IP address from OS API
				var networkInterfaces = os.networkInterfaces();
				for (var dev in networkInterfaces)
				{
					networkInterfaces[dev].forEach(function(details)
					{
						// Check for ipv4 addresses and avoid loopback local alias
						if (details.family == 'IPv4' && details.address != "127.0.0.1")
						{
							selectedAddresses.push(details.address);
						}
					});
				}

				// Check if we found one
				if (selectedAddresses.length == 0)
				{
					cli.warning("No ip for debugging found. Please add your local IP in config file in order to debug over wifi (property name is 'debuggingIP').");
				}
				else
				{
					// Save IP for debugging
					_ipForDebugging = selectedAddresses[0];

					cli.notice("Selected IP for debugging : " + _ipForDebugging);
				}
			}
		}
		
		// Get descriptor data and increment version number if needed
		that.getDescriptorData(configNode.autoIncrement);

		// Browse over avaible compilation target
		var targetName;
		for (var i in AVAILABLE_COMPILATION_TARGETS)
		{
			// Get the target name
			targetName = AVAILABLE_COMPILATION_TARGETS[i];

			// If this target is in the config and package is enabled
			if (targetName in configNode && "package" in configNode[targetName] && configNode[targetName]["package"] != false)
			{
				// Get the targetNode from the configNode
				// And store the sub compilation process with all informations 
				_subCompilingProcesses.push([configNode, configNode[targetName], targetName]);
			}
		}

		// Start sub compiling process
		that.compileNextTarget(configNode);
	},

	/**
	 * Start next target compiling
	 */
	compileNextTarget: function (pConfigNode)
	{
		// If we have no more compiling process
		if (_subCompilingProcesses.length == 0)
		{
			cli.br();

			// If we need to push last apps on devices
			if (pConfigNode.autoInstall) that.pushToDevices();
		}
		else
		{
			// Get the first compiling from the stored processes
			var compilingProcessInformations = _subCompilingProcesses.shift();

			// Call the sub compiling method with proper arguments from compiling process informations
			that.subCompile.apply(that, compilingProcessInformations);
		}
	},

	/**
	 * Create a temp app descriptor xml for compile routine.
	 * Used to specify versionNumber and extensions for a particular target.
	 */
	createTempAppDescription: function (pExtensions, pAppId)
	{
		// The new extension list based on the current
		var extensionsString = _currentExtensions + "\n";

		// Generate new extensions list
		if (pExtensions != null && pExtensions.length > 0)
		{
			// Nasty XML stuff from string. Yek.
			for (var i in pExtensions)
			{
				extensionsString += "	<extensionID>" + pExtensions[i] + "</extensionID>\n	";
			}
		}

		// Try to write the temp app descriptor while replacing extensions list
		try
		{
			fs.writeFileSync(
				// Compute absolute path for XML descriptor
				path.resolve(_configManager.getProjectDirectoryPath() + "/" + _configManager.getClonedDescriptorLink()),

				// Replace values for this target
				that.setXMLTagValue(_descriptorData, {
					extensions: extensionsString,
					id: pAppId
				})
			);
		}
		catch (error)
		{
			// Show error message and exit
			cli.error("Unable to write the temp App descriptor XML file at '" + _configManager.getClonedDescriptorLink() + "'");
			cli.error(error.message);

			// Stop execution
			cli.promptExit(3);
			return;
		}
	},

	/**
	 * Launch a sub compiling process
	 */
	subCompile: function (pConfigNode, pTargetNode, pTargetName)
	{
		cli.br();
		cli.notice("------- Compiling for " + pTargetName + "...");

		// Start timer
		var startTime = new Date().getTime();
		
		// Stack the extensions for this profile and platform
		var extensions = _.union(pConfigNode.extensions, pTargetNode.extensions);
		
		// Create a temp app descriptor for this target
		that.createTempAppDescription(
			// Link new extensions
			extensions,

			// Get the specific appId or use the default one
			pTargetNode.appId != null
			&&
			pTargetNode.appId != ""
			? pTargetNode.appId
			: null
		);

		// Build parameters
		var buildParameters = ["-package"];

		// If we are in debug mode (not only for this target)
		var isDebug = (pConfigNode.debug != null || pConfigNode.debug != false || pConfigNode.debug != '')

		// Compute the output binary extension (doning it here to allow specific target overriding)
		var outputExtension = "." + EXTENSIONS_BY_TARGETS[pTargetName];

		// Check certificate file validity
		if (
				// Check absolute path
				!fs.existsSync(pTargetNode.certificate)

				// Check project relative path
				&& !fs.existsSync(path.resolve(_configManager.getProjectDirectoryPath() + "/" + pTargetNode.certificate))
			)
		{
			// Show error message and exit
			return cli.fatal("Unable to find certificate file at '" + pTargetNode.certificate + "'", 3);
		}

		// Si on compile pour iOS
		if (pTargetName == "ios")
		{
			// Check mobileprovision file validity
			if (
					// Check absolute path
					!fs.existsSync(pTargetNode.mobileProvision)

					// Check project relative path
					&& !fs.existsSync(path.resolve(_configManager.getProjectDirectoryPath() + "/" + pTargetNode.mobileProvision))
				)
			{
				// Show error message and exit
				return cli.fatal("Unable to find mobileprovision file at '" + pTargetNode.mobileProvision + "'", 3);
			}

			// Get the correct ios target subnode for available compile targets
			var iosCompileTargetSubNode = IOS_COMPILE_TARGETS[isDebug ? "debug" : "release"];

			// Default value
			if (pTargetNode.package == true)
			{
				pTargetNode.package = DEFAULT_VALUES.ios_package;
			}

			// Detect if the compile target is valid
			else if (!(pTargetNode.package.toLowerCase() in iosCompileTargetSubNode))
			{
				// Log the error
				return cli.fatal("Error: " + pTargetName + " packaging mode '" + pTargetNode.package + "' is invalid.", 3);
			}

			// Add the proper compile mode for the air compiler
			buildParameters.push("-target");
			buildParameters.push(iosCompileTargetSubNode[pTargetNode.package.toLowerCase()]);

			// Add debugging informations
			that.manageDebuggingParameters(pTargetName, pConfigNode, buildParameters);

			// Enable sampling
			if (pTargetNode.sampling != false)
			{
				buildParameters.push("-sampler");
			}

			// Hide ane libs
			if (pTargetNode.hideAneLib != false)
			{
				buildParameters.push("-hideAneLibSymbols yes");
			}

			// USE NEW COMPILER

			// Add certificate informations
			that.manageMobileCertificate(pTargetNode, buildParameters);

			// Add provisioning profile
			buildParameters.push("-provisioning-profile");
			buildParameters.push('"' + pTargetNode.mobileProvision + '"');
		}
		else if (pTargetName == "android")
		{
			// Detect if the compile target is valid
			if (pTargetNode.package != true)
			{
				// Log the error
				return cli.fatal("Error: " + pTargetName + " packaging mode '" + pTargetNode.package + "' is invalid.", 3);
			}

			// Add the proper compile mode for the air compiler
			buildParameters.push("-target");
			buildParameters.push(ANDROID_COMPILE_TARGETS[isDebug ? "debug" : "release"]);

			// Add debugging informations
			that.manageDebuggingParameters(pTargetName, pConfigNode, buildParameters);

			// Add certificate informations
			that.manageMobileCertificate(pTargetNode, buildParameters);
		}
		else if (pTargetName == "air")
		{
			// Add certificate informations
			that.manageMobileCertificate(pTargetNode, buildParameters);

			// Add debugging informations
			that.manageDebuggingParameters(pTargetName, pConfigNode, buildParameters);
		}
		else if (pTargetName == "windows" || pTargetName == "mac")
		{
			// Add certificate informations
			that.manageMobileCertificate(pTargetNode, buildParameters);

			// Specify target
			buildParameters.push("-target");

			// Check if we are on bundle export mode
			if (
					// Only for windows
					pTargetName == "windows"
					&&
					(
						// Check default value
						pTargetNode.package == true
						||
						// Or if its specified
						pTargetNode.package.toLowerCase() == "bundle"
					)
				)
			{
				// No binary extension (the output is a folder)
				outputExtension = "/";

				// Export as bundle
				buildParameters.push("bundle");
			}
			else
			{
				// Export as native
				buildParameters.push("native");
			}

			// Add debugging informations
			that.manageDebuggingParameters(pTargetName, pConfigNode, buildParameters);
		}

		// Generate output file name from content file name and extension
		var outputFilename = _appName + "-" + _currentMajorVersionNumber + "-" + _configManager.getCompilingProfile() + outputExtension;

		// And generate path to the output binary
		var outputPath = (
			// Check if an output directory is specified
			_configManager.getConfigData().outDirectory != null
			&&
			_configManager.getConfigData().outDirectory.length > 0
			?
			_configManager.getConfigData().outDirectory + "/" + outputFilename
			:
			outputFilename
		);

		// Add outputfile
		buildParameters.push(outputPath);

		// Try to add included files
		try
		{
			that.manageIncludedFiles(_configManager.getConfigData(), buildParameters);
		}
		catch (error)
		{
			// Show error message and exit
			return cli.fatal(error.message, 3);
		}

		// Generate compiling command using ADT
		_commandBuilder.execute("adt", buildParameters, function (error, stdout, stderr, command)
		{
			// Check error
			if (error != null)
			{
				// Show the last used command
				cli.br();
				cli.error("-> Failed! Error while compiling for " + pTargetName);
				cli.br();
				cli.warning("Last command :");
				cli.notice(command);

				// Additionnal information
				cli.br();
				cli.warning("Error :");
				if (stdout != "") cli.notice(stdout);
				if (stderr != "") cli.notice(stderr);

				// Let the user see the message
				cli.promptExit(3);
			}
			else
			{
				// Compute elapsed compiling time
				var elapsedTime = Math.round((new Date().getTime() - startTime) / 100) / 10;

				// Compiling ok
				cli.success("-> Success! Compiled to '" + outputPath + "' in " + elapsedTime + "s");

				// Add to the compiled list
				that.addCompiledBinaryPath(pTargetName, outputPath);

				// Start sub compiling process
				that.compileNextTarget(pConfigNode);
			}
		});
	},

	/**
	 * Manage mobile certificates informations for compiling command
	 */
	manageMobileCertificate: function (pTargetNode, pBuildParameters)
	{
		// Add link to the certificate
		pBuildParameters.push("-storetype pkcs12");
		pBuildParameters.push("-keystore");
		pBuildParameters.push('"' + pTargetNode.certificate + '"');

		// Add certificate password
		pBuildParameters.push("-storepass");
		pBuildParameters.push('"' + pTargetNode.password + '"');
	},

	/**
	 * Manage debug parameters for compiling command
	 */
	manageDebuggingParameters: function (pTargetName, pConfigNode, pBuildParameters)
	{
		// TODO: USB DEBUGGING

		/*
		// Enable debug listening over USB
		if (pConfigNode.debug)
		{
			pBuildParameters.push("-listen");
		}
		*/

		// Check if debugging is deactivated
		if (pConfigNode.debug != null && pConfigNode.debug != false && pConfigNode.debug != '')
		{
			// Check if the debug config parameter is set to true, which is incorrect due to the limitation of maximum one debug target
			if (pConfigNode.debug == true)
			{
				cli.fatal("Debug property can't be set to true, only one target can be debugged. Please specify which one.", 3);
			}

			// Check if the debug target is available as compilation target and exists in the current profile
			else if (!(pConfigNode.debug) in AVAILABLE_COMPILATION_TARGETS || !(pConfigNode.debug in pConfigNode))
			{
				cli.fatal("debug: '" + pConfigNode.debug + "' is an invalid target for debugging.", 3);
			}

			// Check if we have a valid IP for debbuging
			else if (_ipForDebugging == null || _ipForDebugging.length == 0)
			{
				cli.fatal("No valid IP found for debugging over wifi.", 3);
			}

			// All is OK
			else if (pConfigNode.debug == pTargetName)
			{
				// Add connect for debugging option and local IP
				pBuildParameters.push("-connect");
				pBuildParameters.push('"' + _ipForDebugging + '"');
			}
		}
	},

	/**
	 * Manage included file for the compile command line.
	 */
	manageIncludedFiles: function (pConfigNode, pBuildParameters)
	{
		// Include TEMP app descriptor file
		pBuildParameters.push(_configManager.getClonedDescriptorLink());
		
		// If we have an app directory
		if (_configManager.getConfigData().appDirectory != null && _configManager.getConfigData().appDirectory.length > 0)
		{
			// Include from relative folder
			pBuildParameters.push("-C");
			pBuildParameters.push('"' + _configManager.getConfigData().appDirectory + '"');
			pBuildParameters.push('"' + _swfContent + '"');
		}
		else
		{
			// Directly add the link to the swf
			pBuildParameters.push(_swfContent);
		}

		// Browse files to include
		for (var i in pConfigNode.assets)
		{
			// Find the folder delimiter
			var folderLink = pConfigNode.assets[i];
			var splittedPath = folderLink.split("///");

			// Folder parameters for the compiler
			var folderParam1;
			var folderParam2;

			// Too much wow
			if (splittedPath.length > 2)
			{
				throw new Error("Incorrect use of the /// separator. Please use max one by folder path to delimit the folder to include.");
				return;
			}

			// Separator, include the folder
			else if (splittedPath.length == 2)
			{
				// Reconstruct the folder link
				folderLink = splittedPath[0] + "/" + splittedPath[1];

				// Set correct folder parameters
				folderParam1 = splittedPath[0];
				folderParam2 = splittedPath[1];
			}

			// No separator, include all files in the folder
			else
			{
				// Set correct folder parameters
				folderParam1 = folderLink;
				folderParam2 = ".";
			}

			// Check if the file exists
			if (!fs.existsSync(path.resolve(_configManager.getProjectDirectoryPath() + "/" + folderLink)))
			{
				throw new Error("Unable to include file " + folderLink + " in the binary, file not found.");
				return;
			}

			// Include to the root
			pBuildParameters.push("-C");
			pBuildParameters.push('"' + folderParam1 + '"');
			pBuildParameters.push('"' + folderParam2 + '"');
		}
		
		// Check if we have extensions
		if (pConfigNode.aneDirectory != null && pConfigNode.aneDirectory != "")
		{
			// Check ANE directory
			if (
					// Check absolute path
					!fs.existsSync(pConfigNode.aneDirectory)

					// Check project relative path
					&& !fs.existsSync(path.resolve(_configManager.getProjectDirectoryPath() + "/" + pConfigNode.aneDirectory))
				)
			{
				throw new Error("Unable to target ane directory '" + pConfigNode.aneDirectory + "', directory not found.");
				return;
			}

			// Inclure ANE directory
			pBuildParameters.push("-extdir");
			pBuildParameters.push(pConfigNode.aneDirectory);
		}
	},


	/********************************************************************************************
	 * 										PUSHING TO DEVICES
	 ********************************************************************************************/
	pushToDevices: function (pBinaryPath)
	{
		cli.notice("Install on connected devices.");

		// Get descriptor data without incrementing version number if not already catched
		if (_appName == null && _appID == null)
		{
			that.getDescriptorData(false);
		}

		// Get the compiled last paths
		var compiledBinaries = that.getCompiledBinariesPaths();

		// Nothing done yet
		var hasIOS = false;
		var hasAndroid = false;
		
		// Target the compiled binaries node 
		var compiledBinariesNode = null;

		// Get compiling profile from config
		compilingProfile = _configManager.getCompilingProfile();
		
		// If the compile profile is found in the compiled binaries
		if (compilingProfile != "push" && compilingProfile in compiledBinaries)
		{
			// Target from the compile profile
			compiledBinariesNode = compiledBinaries[compilingProfile];
		}
		else
		{
			// Else, search the most recent compiled profile
			var mostRecentTimestamp = 0;
			for (var i in compiledBinaries)
			{
				// Check if we have a correct timestamp
				if ("_timestamp" in compiledBinaries[i] && compiledBinaries[i]._timestamp > mostRecentTimestamp)
				{
					// This timestamp is most recent, keep it
					mostRecentTimestamp = compiledBinaries[i]._timestamp;
					compiledBinariesNode = compiledBinaries[i];
				}
			}
		}
		
		// Check if our profile is recorded
		if (compiledBinariesNode != null)
		{
			// Detect if we have iOS or Android binaries to push
			hasIOS = ("ios" in compiledBinariesNode);
			hasAndroid = ("android" in compiledBinariesNode);

			// Logging the detecting state
			if (hasIOS || hasAndroid)
			{
				cli.notice("Detecting " + (hasIOS ? "iOS" : "") + (hasIOS && hasAndroid ? " and " : "") + (hasAndroid ? "Android" : "") + " devices...");
			}

			// Upload latest IPA binary to connect iOS devices
			if (hasIOS)
			{
				// Push last version on iOS
				that.pushToiOS(compiledBinariesNode.ios);
			}

			// Upload latest APK binary to connect Android devices
			if (hasAndroid)
			{
				// Push last version on Android
				that.pushToAndroid(compiledBinariesNode.android);
			}
		}

		// If we havn't done anything
		if (!hasIOS && !hasAndroid)
		{
			cli.warning("No compiled binaries (android or ios) found for this profile or no recent compiled profile found.");
			cli.promptExit(0);
		}
	},

	/**
	 * Push an IPA binary on every connected iOS devices
	 */
	pushToiOS: function (pBinaryPath)
	{
		// Get android devices list
		that.listDevices("ios", function (pError, pDevicesIDs)
		{
			// Show common advice if we got any problems
			if (pError != null || pDevicesIDs.length == 0)
			{
				cli.error("No iOS devices detected");
				cli.notice("Note: in order to be detected, you need to have the latest iTunes installed and at least the iTunes service running in background. Starting iTunes can help discovering, even if the service is running.");
				cli.br();
			}

			// Detect error
			if (pError != null)
			{
				cli.error("Error while discovering iOS devices via USB");
				return cli.notice(pError.message);
			}

			// If we got someting
			if (pDevicesIDs.length > 0)
			{
				cli.success(pDevicesIDs.length + " iOS device" + (pDevicesIDs.length > 0 ? "s" : "") + " detected. Installing...");

				// Install on all devices
				for (var i in pDevicesIDs)
				{
					that.installOnDevice("ios", pBinaryPath, pDevicesIDs[i]);
				}
			}
		});
	},

	/**
	 * Push an APK binary on every connected Android devices
	 */
	pushToAndroid: function (pBinaryPath)
	{
		// Get android devices list
		that.listDevices("android", function (pError, pDevicesIDs)
		{
			// Show common advice if we got any problems
			if (pError != null || pDevicesIDs.length == 0)
			{
				cli.error("No Android devices detected");
				cli.notice("Note: in order to be detected, android devices need to have the 'USB debugging' option enabled. If it's still not detected, try instlaling ADB drivers (included in Android SDK and Air SDK) and restart ADB service ('adb kill-server' and adb 'start-server').");
				cli.br();
			}

			// Detect error
			if (pError != null)
			{
				cli.error("Error while discovering Android devices via USB");
				return cli.notice(pError.message);
			}

			// If we got someting, install
			if (pDevicesIDs.length > 0)
			{
				cli.success(pDevicesIDs.length + " Android device" + (pDevicesIDs.length > 0 ? "s" : "") + " detected. Installing...");

				// Install on all devices
				for (var i in pDevicesIDs)
				{
					that.subPushToAndroid(pBinaryPath, pDevicesIDs[i]);
				}
			}
		});
	},

	/**
	 * Sub method for android push to keep scope while we have multiple devices
	 */
	subPushToAndroid: function (pBinaryPath, pDeviceID)
	{
		// Delete the old app
		that.removeOnDevice("android", _appID, pDeviceID, function (pSuccess)
		{
			// Install the new app
			that.installOnDevice("android", pBinaryPath, pDeviceID, function (pSuccess)
			{
				if (pSuccess)
				{
					// Launch app
					// ONLY SUPPORTED ON ANDROID BY AIR SDK
					that.launchOnDevice("android", _appID, pDeviceID);
				}
			});
		});
	},

	/**
	 * Install binary on a specific device
	 */
	installOnDevice: function (pPlatform, pBinaryPath, pDeviceID, pHandler)
	{
		// Call ADT from the SDK
		_commandBuilder.execute(
			"adt",
			[
				"-installApp",
				"-platform",
				pPlatform,
				"-device",
				'"' + pDeviceID + '"',
				"-package",
				pBinaryPath
			],
			function (error, stdout, stderr, command)
			{
				// Detect errors
				if (error != null)
				{
					cli.br();
					cli.error("-> Error while installing " + pBinaryPath + " to " + pPlatform + " device " + pDeviceID);
					cli.notice(error.message);
					cli.br();
					cli.warning("Last command :");
					cli.notice(command);
					cli.notice("Process output :");
					cli.warning(stdout);
				}
				else
				{
					// \o/
					cli.success("-> Successfully installed on " + pPlatform + " device " + pDeviceID);
				}

				// Next
				if (pHandler != null)
				{
					pHandler(error == null);
				}
			}
		);
	},

	/**
	 * Lauch app on connected device
	 */
	launchOnDevice: function (pPlatform, pAppID, pDeviceID, pHandler)
	{
		// Call ADT from the SDK
		_commandBuilder.execute(
			"adt",
			[
				"-launchApp",
				"-platform",
				pPlatform,
				"-device",
				'"' + pDeviceID + '"',
				"-appid",
				pAppID
			],
			function (error, stdout, stderr, command)
			{
				//cli.br();

				// Detect errors
				if (error != null)
				{
					cli.error("-> Error while launching " + pAppID + " on " + pPlatform + " device " + pDeviceID);
					cli.notice(error.message);
					cli.br();
					cli.warning("Last command :");
					cli.notice(command);
					cli.warning("Process output :");
					cli.notice(stdout);
				}

				// Next
				if (pHandler != null)
				{
					pHandler(error == null);
				}
			}
		);
	},

	/**
	 * Remove specific app on a connected device
	 */
	removeOnDevice: function (pPlatform, pAppID, pDeviceID, pHandler)
	{
		// Call ADT from the SDK
		_commandBuilder.execute(
			"adt",
			[
				"-uninstallApp",
				"-platform",
				pPlatform,
				"-device",
				'"' + pDeviceID + '"',
				"-appid",
				pAppID
			],
			function (error, stdout, stderr, command)
			{
				// Next
				if (pHandler != null)
				{
					pHandler(error == null);
				}
			}
		);
	},

	/**
	 * List all connected devices
	 */
	listDevices: function (pPlatform, pCallback)
	{
		// Check arguments
		if (pPlatform != "android" && pPlatform != "ios")
		{
			throw new Error("Invalid platform for device listing.");
			return;
		}

		// Id pattern detection
		//var iosUDIDPattern = /([0-9a-fA-F]{40})/gi;
		var iosIDPattern = /(\s[0-9]+\t)/igm;
		var androidIDPattern = /([0-9]{11})/gi;

		// Call ADT from the SDK
		_commandBuilder.execute(
			"adt",
			[
				"-devices",
				"-platform",
				pPlatform
			],
			function (error, stdout, stderr, command)
			{
				//cli.br();
				
				// Detect errors
				if (error != null)
				{
					cli.error("-> Error while detecting " + pPlatform + " devices.");
					cli.notice(error.message);
					cli.br();
					cli.warning("Last command :");
					cli.notice(command);
					cli.warning("Process output :");
					cli.notice(stdout);

					// Relay the error to the callback
					pCallback(error);
				}

				// Devices id list
				var devicesIDs;

				// Extract device IDs from the output depending on the platform
				if (pPlatform == "ios")
				{
					// Extract from the stdout
					devicesIDs = stdout.match(iosIDPattern);

					// Browse to convert
					for (var i in devicesIDs)
					{
						// Convert each id to number
						devicesIDs[i] = parseInt(devicesIDs[i].substring(devicesIDs[i].lastIndexOf(" "), devicesIDs[i].indexOf("\t")), 10);
					}
				}
				else if (pPlatform == "android")
				{
					// Directly extract
					devicesIDs = stdout.match(androidIDPattern);
				}

				// Call the handler with devices IDs if possible
				pCallback(null, devicesIDs == null ? [] : devicesIDs);
			}
		);
	},
};
module.exports = that;