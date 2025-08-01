// This file is used to override the REST API resources configuration
import {
  AmplifyApiRestResourceStackTemplate,
  AmplifyProjectInfo,
} from "@aws-amplify/cli-extensibility-helper";

export function override(
  resources: AmplifyApiRestResourceStackTemplate,
  amplifyProjectInfo: AmplifyProjectInfo
) {
  // Replace the following with your Auth resource name
  const authResourceName = "cognitoaccountmanager";
  const userPoolArnParameter = "AuthCognitoUserPoolArn";

  // Add a parameter to your Cloud Formation Template for the User Pool's ID
  resources.addCfnParameter(
    {
      type: "String",
      description:
        "The ARN of an existing Cognito User Pool to authorize requests",
      default: "NONE",
    },
    userPoolArnParameter,
    { "Fn::GetAtt": [`auth${authResourceName}`, "Outputs.UserPoolArn"] }
  );

  // Create the authorizer using the AuthCognitoUserPoolArn parameter defined above
  resources.restApi.addPropertyOverride("Body.securityDefinitions", {
    Cognito: {
      type: "apiKey",
      name: "Authorization",
      in: "header",
      "x-amazon-apigateway-authtype": "cognito_user_pools",
      "x-amazon-apigateway-authorizer": {
        type: "cognito_user_pools",
        providerARNs: [
          {
            "Fn::Join": ["", [{ Ref: userPoolArnParameter }]],
          },
        ],
      },
    },
  });

  // For every path in your REST API
  for (const path in resources.restApi.body.paths) {
    // Add the Authorization header as a parameter to requests
    resources.restApi.addPropertyOverride(
      `Body.paths.${path}.x-amazon-apigateway-any-method.parameters`,
      [
        ...resources.restApi.body.paths[path]["x-amazon-apigateway-any-method"]
          .parameters,
        {
          name: "Authorization",
          in: "header",
          required: false,
          type: "string",
        },
      ]
    );
    // Use your new Cognito User Pool authorizer for security
    resources.restApi.addPropertyOverride(
      `Body.paths.${path}.x-amazon-apigateway-any-method.security`,
      [{ Cognito: [] }]
    );
  }
}
