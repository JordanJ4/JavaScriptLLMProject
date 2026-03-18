# JavaScript Azure LLM Project

    Azure Function (Node.js) deployed via GitHub Actions.

    ## Endpoint
    POST /api/coach

    ## Request Body
    ```json
    {
      "input": "string",
      "persona": "string",
      "scenario": "string"
    }
    ```

    ## Response
    ```json
    {
      "reply": "• bullet
• bullet"
    }
    ```