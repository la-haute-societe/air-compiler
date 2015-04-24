module.exports = {
	// Java runtime directory or command caller
	// If java path is not defined, you can directly target the java.exe like this "C:/progra~2/Java/jre7/bin/java.exe"
	java: "java",

	// Root directory of the Air SDK with ending /
	airSDK: "C:/PATH_TO_AIR_SDK/",

	// Application directory (where the main .swf is)
	// All files in this directory will be included in the application
	appDirectory: "bin",

	// Output directory for platform specific compiled applications 
	outDirectory: "dist",

	// Directory where native extensions (.ane) can be picked
	aneDirectory: "lib/ane/",

	// Included assets in the application
	// Optional : Use "///" to target the folder to include in the folder path.
	assets: [
		"bin///media", // Will include the folder "media" in the app root. If you remove the "///", the command will include the folder "bin/media" in the app root.
		"lib/icons/" // Will include every file and folder contained in this folder
	],
	
	// Application descriptor XML
	appDescriptor: "description.xml",

	// Local IP for debugging over wifi
	// If the script doesn't find your local IP, please provide one.
	debuggingIP: "",

	// Simulation configuration
	simulation: {

		// HERE -> you can create as many simulation profile as you need

		// Freely name your simulation profile
		androidTab: {
			// Screen resolution to simulate
			// Let void to simulate without forcing mobile mode
			// Accepted values at http://help.adobe.com/en_US/air/build/WSfffb011ac560372f-6fa6d7e0128cca93d31-8000.html
			resolution: "800x400:800x400",

			// Force a specific profile.
			// Accepted values are 'desktop' / 'extendedDesktop' / 'mobileDevice'
			// Default is "mobileDevice" if a resolution is setted, else the first profile from the app-descriptor XML is used.
			profile: "",

			// Simulated density in DPI (non documented feature, more info on https://plus.google.com/117271975527324598054/posts/B22GePKXZZY)
			// Setting this non document parameter can add weird behavior about DPI in the simulator
			density: 300,

			// Simulated platform (non documented feature)
			// Setting this non document parameter can add weird behavior about DPI in the simulator
			// Accepted values are : 'android' / 'ios'
			// Let void or false to ignore
			platform: "android",

			// Lauch simulator with "login" reason in invoke event
			// Default is false
			atLogin: false,

			// Arguments associated to the invoke event
			arguments: []
		},

		// iPad screens
		ipad: {
			resolution: "iPad"
		},

		// iPhone 4- screens
		iphone: {
			resolution: "iPhone"
		},

		// iPhone 5+ screens
		iphone5: {
			resolution: "320x548:320x568"
		}
	},

	// Binaries production configuration
	outputs: {

		// HERE -> you can create as many compiling profile as you need
		
		// Freely name your binary production profile
		test : {
			// Provide the ID of your app, this will override <id> in XML app descriptor
			// Let void or null to use the main one
			appID: "",
			
			// Activate debug on a specific target.
			// Accepted values are false (or '') / ios / android / air / windows / mac
			debug: false,

			// List of native extensions IDs added for all targets in this profile
			extensions: [
			],

			// Auto-install compiled app on compatible wired hardware
			// Available for iOS and Android only.
			// Accepted values are 
			autoInstall: true,
			
			// Auto-increment version on application descriptor XML
			autoIncrement: true,

			// Enabled publication targets
			ios: {
				// Enable ios packaging
				// Accepted values are : 'interpreter' / 'test' / 'adhoc' / 'appstore'. Default is 'test'
				package: 'interpreter',

				// List of native extensions IDs added for this target
				extensions: [
				],

				// Signing options (have to be signed with apple provisioning portal)
				certificate: "PATH_TO_P12",
				password: "p4ssw0rd",
				
				// Activate sampling with Adobe Scout
				sampling: false,

				// Isolate embeded ANE classes. Only if you have compatibility issues between ANEs.
				hideAneLib: false,

				// Use the new iOS compiler
				newCompiler: false,

				// Only for iOS, link to mobileProvision file provided by apple provisioning portal
				mobileProvision: "PATH_TO_MOBILE_PROVISION"
			},

			android: {
				// Enable android packaging
				// Accepted values are : true / false
				package: true,

				// List of native extensions IDs added for this target
				extensions: [
				],

				// Signing options (can be auto-signed)
				certificate: "PATH_TO_P12",
				password: "p4ssw0rd"
			},

			air: {
				// Enable air runtime packaging
				// Accepted values are true / false
				package: false,

				// List of native extensions IDs added for this target
				extensions: [
				],

				// Signing options (can be auto-signed)
				certificate: "PATH_TO_P12",
				password: "p4ssw0rd"
			},

			windows: {
				// Enable windows desktop packaging
				// Accepted values are : 'bundle' / 'installer'.  Default is 'bundle'
				package: false,

				// List of native extensions IDs added for this target
				extensions: [
				],

				// Signing options (can be auto-signed)
				certificate: "PATH_TO_P12",
				password: "p4ssw0rd"
			},

			mac: {
				// Enable mac packaging
				// Accepted values are true / false
				package: false,

				// List of native extensions IDs added for this target
				extensions: [
				],

				// Signing options (can be auto-signed)
				certificate: "PATH_TO_P12",
				password: "p4ssw0rd"
			}
		},

		// Another ouput profile...
		deploy: {
			// Copy paste "test" profile config here
		}
	}
};