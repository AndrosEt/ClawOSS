# Repository: jenkinsci/warnings-ng-plugin

## Tech Stack
- Java (Jenkins plugin)
- Maven/Gradle build system
- Analysis model library for parsing warnings

## Project Structure
- Plugin source in standard Jenkins plugin structure
- Analysis model in separate module
- UI components using Jelly/Jenkins taglibs

## Code Style
- Standard Java conventions
- Jenkins plugin development patterns
- Follow existing patterns in analysis-model module

## Notes
- This is a Jenkins plugin for aggregating compiler warnings
- The analysis-model component handles parser definitions
- Issue is in how linter names are HTML-escaped in the UI