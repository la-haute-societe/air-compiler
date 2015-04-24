// Include stuff
var ExecuteChildProcess = require('child_process').exec;

// Config manager
var _configManager;

// Link to SDK binaries
var _ADLLink;
var _ADTLink;

/**
 * Public scope
 */
var that = {
	/**
	 * Init the command builder with a valid configManager
	 */
	init: function (pConfigManager)
	{
		// Store the config manager
		_configManager = pConfigManager;

		// Target config
		var configData = _configManager.getConfigData();

		// Build links to SDK binaries
		_ADLLink = configData.airSDK + "bin/adl";
		_ADTLink = configData.java + " -jar \"" + configData.airSDK + "lib/adt.jar\"";
	},

	/**
	 * Build air simulation or compiling command from an array of arguments
	 */
	buildAirCommand: function (pSubProcess, pParameters)
	{
		return [pSubProcess].concat(pParameters).join(" ");
	},

	/**
	 * Execute a command with the SDK
	 */
	execute: function (pSDKBinaryName, pOptions, pHandler)
	{
		// Build the command depending on the binaray
		var command;

		// ADL or ADT ?
		if (pSDKBinaryName == "adl")
		{
			command = that.buildAirCommand(_ADLLink, pOptions);
		}
		else if (pSDKBinaryName == "adt")
		{
			command = that.buildAirCommand(_ADTLink, pOptions);
		}
		
		// Execute the command
		ExecuteChildProcess(command, {
				// Execute the command at the root of the project
				cwd: _configManager.getProjectDirectoryPath()
			},

			// Relay handler
			function (error, stdout, stderr)
			{
				if (pHandler != null)
				{
					pHandler(error, stdout, stderr, command);
				}
			}
		);
	}
};
module.exports = that;