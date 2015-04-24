// Include stuff
var fs = require("fs");
var path = require("path");
var cli = require("./cli.js");
var configManager = require("./config-manager.js");
var commandBuilder = require("./command-builder.js");
var compiler = require("./compiler.js");

/**
 * Public scope
 */
var that = {
	/**
	 * If we are in process mode, air compiler can control the process
	 */
	processMode: false,

	/**
	 * Current module version
	 */
	version: require('../package').version,

	/**
	 * Run the helper
	 */
	run: function (pProjectDirectory, pProfile, pOption)
	{
		// "SKIP INTRO LOL"
		if (that.processMode)
		{
			cli.br();
			cli.notice("--------------------------------------------------------------------------------");
			cli.warning("                                Air Compiler " + that.version + "\n");
			cli.notice("--------------------------------------------------------------------------------");
		}

		// Define the exit behavior and the cli helper for fatal errors
		cli.allowFatalToQuit = that.processMode;

		// Check project directory argument
		if (pProjectDirectory == null || pProjectDirectory == "" || typeof(pProjectDirectory) != "string")
		{
			return cli.fatal("Please provide a valid project directory.", true);
		}

		// Check the project directory argument as a path
		if (!fs.existsSync(pProjectDirectory))
		{
			return cli.fatal("The project directory " + pProjectDirectory + " can't be found.", true);
		}

		// Check compiling profile argument
		if (pProfile == null || pProfile == "" || typeof(pProfile) != "string")
		{
			return cli.fatal("Please provide a valid target (either simulation or compilation).", true);
		}

		// Init config manager with project path
		if (configManager.init(pProjectDirectory) != true) return;

		// Load config file
		if (configManager.loadConfig() != true) return;

		// Check config file structure and properties
		if (configManager.checkConfigWithProfile(pProfile) != true) return;

		// So far so good
		cli.success("Config loaded");

		// Create the temp directory in the project directory
		try
		{
			fs.mkdirSync(path.resolve(pProjectDirectory + "/tmp/"), 0766);
		}
		catch (e) { }

		// Init the command builder with the config manager
		commandBuilder.init(configManager);

		// Init the compiler with the config manager and the command builder
		compiler.init(configManager, commandBuilder);

		// Execute the compiler
		compiler.execute();
	}
};
module.exports = that;