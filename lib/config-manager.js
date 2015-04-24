// Include stuff
var fs = require("fs");
var path = require("path");
var cli = require("./cli.js");

// Required config properties at first level
var REQUIRED_CONFIG_PROPS = [
	"java",
	"airSDK",
	"appDirectory",
	"outDirectory",
	"aneDirectory",
	"assets",
	"appDescriptor",
	"simulation",
	"outputs"
];

// The project directory path
var _projectDirectoryPath;

// The default config file created if the user config file is not found
var _defaultConfigFile = "./default.compiler.config.js";

// Config file name and global path
var _configFileName = "compiler.config.js";
var _configFilePath;

// All raw config data
var _configData;

// Links to the XML app descriptor and its cloned version
var _baseDescriptorLink;
var _clonedDescriptorLink;

// Current compiling mode and compiling profile used
var _compilingMode;
var _compilingProfile;

/**
 * Public scope
 */
var that = {

	/**
	 * GET CONFIG INFORMATION
	 */

	getProjectDirectoryPath: function () { return _projectDirectoryPath; },

	getConfigData: function () { return _configData; },

	getDescriptorLink: function () { return _baseDescriptorLink; },

	getClonedDescriptorLink: function () { return _clonedDescriptorLink; },

	getCompilingMode: function () { return _compilingMode; },

	getCompilingProfile: function () { return _compilingProfile; },

	getSimulationConfigNodeForProfile: function ()
	{
		return _configData.simulation[_compilingProfile];
	},

	getCompilingConfigNodeForProfile: function ()
	{
		return _configData.outputs[_compilingProfile];
	},


	/**
	 * Init config manager
	 */
	init: function (pProjectDirectoryPath)
	{
		// Store the project directory
		_projectDirectoryPath = pProjectDirectoryPath;

		// Path of the config file from project directory
		_configFilePath = path.resolve(pProjectDirectoryPath, _configFileName);
	},

	/**
	 * Create the default config file in the current project folder
	 */
	createDefaultConfig: function (pLibPath)
	{
		// Check if the config file already exists
		if (fs.existsSync(_configFilePath))
		{
			cli.warning("The file 'compiler.config.js' already exists.");
			return false;
		}

		// Copy the default config and prompt user to update the file
        try
        {
            fs.writeFileSync(_configFilePath, fs.readFileSync(pLibPath + _defaultConfigFile));
        }
        catch (error)
        {
            return false;
        }
        return true;
	},

	/**
	 * Load config file
	 */
	loadConfig: function ()
	{
        // If the config file is not found
        if (!fs.existsSync(_configFilePath))
        {
            return cli.fatal("Config file not found. Use air-compiler init to create a config file in your project folder.", 4);
        }

		// Get user config if possible
		try
		{
			_configData = require(_configFilePath);
		}
		catch (error)
		{
			// Stop execution with error
			return cli.fatal("Error while loading config file at '" + _configFilePath + "', please check javascript syntax.\n" + error.message, 5);
		}

		// All is ok
		return true;
	},

	/**
	 * Check if a profile is valid on current config
	 */
	checkConfigWithProfile: function (pProfile)
	{
		// Store the used profile
		_compilingProfile = pProfile;

		// Check basic config stuff
		for (var i in REQUIRED_CONFIG_PROPS)
		{
			// Check if this property is in the config
			if (!(REQUIRED_CONFIG_PROPS[i] in _configData))
			{
				// Config property missing
				throw new Error("Config property " + REQUIRED_CONFIG_PROPS[i] + " is missing", 6);
			}
		}

		// Get source descriptor and cloned descriptor link relative to the project
		_baseDescriptorLink = _configData.appDescriptor;
		_clonedDescriptorLink = "tmp/" + _configData.appDescriptor + ".temp";
		
		// Check the app descriptor file
		var descriptorPath = path.resolve(_projectDirectoryPath + "/" + _baseDescriptorLink);
		if (_baseDescriptorLink == null || !fs.existsSync(descriptorPath))
		{
			return cli.fatal("App descriptor XML file not found at '" + descriptorPath + "'", 7);
		}

		// Check if the compile profile exists in simulation profiles
		if (_compilingProfile in _configData.simulation)
		{
			_compilingMode = "simulate";
		}

		// Check if the compile profile exists in compiling profiles
		else if (_compilingProfile in _configData.outputs)
		{
			_compilingMode = "compile";
		}
		
		// Check if we are in the special command "push to devices"
		else if (_compilingProfile.toLowerCase() == "push")
		{
			_compilingMode = "push";
		}

		// Invalid compile profile
		else
		{
			return cli.fatal("Invalid compile profile, '" + _compilingProfile + "' profile not found.", 8);
		}

		// All is ok
		return true;
	}
};
module.exports = that;